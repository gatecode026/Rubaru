const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Socket.io Handshake Authentication Middleware
 */
async function socketAuthMiddleware(socket, next) {
  try {
    let token = null;

    // 1. Extract token from auth payload or authorization header
    if (socket.handshake.auth && socket.handshake.auth.token) {
      token = socket.handshake.auth.token;
    } else if (socket.handshake.headers && socket.handshake.headers.authorization) {
      const authHeader = socket.handshake.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else {
        token = authHeader;
      }
    } else if (socket.handshake.query && socket.handshake.query.token) {
      // Allow legacy query token fallback for older client builds
      token = socket.handshake.query.token;
    }

    if (!token) {
      const err = new Error('Authentication required: No token provided');
      err.data = { code: 'AUTHENTICATION_REQUIRED' };
      return next(err);
    }

    // 2. Verify JWT signature & expiration
    const secret = process.env.JWT_SECRET || 'secret';
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (jwtErr) {
      const err = new Error('Authentication failed: Invalid or expired token');
      err.data = { code: jwtErr.name === 'TokenExpiredError' ? 'AUTHENTICATION_EXPIRED' : 'AUTHENTICATION_INVALID' };
      return next(err);
    }

    // 3. Verify User Account in Database
    const user = await User.findById(decoded.id).select('_id email phone accountStatus isAgeVerified isPhoneVerified');
    if (!user) {
      const err = new Error('Authentication failed: User account not found');
      err.data = { code: 'ACCOUNT_NOT_FOUND' };
      return next(err);
    }

    if (user.accountStatus === 'DELETED' || user.accountStatus === 'BANNED' || user.accountStatus === 'SUSPENDED') {
      const err = new Error('Authentication failed: User account is suspended or deleted');
      err.data = { code: 'ACCOUNT_UNAVAILABLE' };
      return next(err);
    }

    // 4. Attach server-controlled identity context
    const tokenExpiresAt = decoded.exp ? decoded.exp * 1000 : null;
    socket.data = {
      userId: user._id.toString(),
      tokenExpiresAt,
      correlationId: socket.id,
      authenticatedAt: Date.now(),
    };

    // Backward compatibility
    socket.user = user;

    // 5. Schedule token expiration disconnect timer if expiration is present
    if (tokenExpiresAt) {
      const remainingMs = tokenExpiresAt - Date.now();
      const MAX_TIMEOUT_MS = 2147483647; // Max 32-bit signed integer for setTimeout (~24.8 days)

      if (remainingMs > MAX_TIMEOUT_MS) {
        // Token expires far in the future (> 24 days) - no immediate disconnect needed
      } else if (remainingMs > 0) {
        const expiryTimer = setTimeout(() => {
          console.warn(`[SOCKET AUTH] Token expired for user ${socket.data.userId}. Disconnecting socket ${socket.id}`);
          socket.emit('messaging.error', {
            ok: false,
            code: 'AUTHENTICATION_EXPIRED',
            message: 'Session has expired. Please reauthenticate.',
          });
          socket.disconnect(true);
        }, remainingMs);

        socket.on('disconnect', () => {
          clearTimeout(expiryTimer);
        });
      } else {
        const err = new Error('Authentication failed: Token has expired');
        err.data = { code: 'AUTHENTICATION_EXPIRED' };
        return next(err);
      }
    }

    next();
  } catch (error) {
    console.error('[SOCKET AUTH] Unexpected error:', error.message);
    const err = new Error('Authentication error');
    err.data = { code: 'AUTHENTICATION_ERROR' };
    return next(err);
  }
}

module.exports = {
  socketAuthMiddleware,
};

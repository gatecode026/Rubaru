/**
 * Rubaru Admin Authorization & Permission Middleware
 * Enforces granular RBAC permissions for administrative routes.
 */

const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    if (req.user.accountStatus !== 'ACTIVE') {
      return res.status(403).json({
        ok: false,
        code: 'ACCOUNT_INACTIVE',
        message: 'Account is suspended or inactive',
      });
    }

    // Check if user has permission
    if (typeof req.user.hasPermission === 'function') {
      if (req.user.hasPermission(permission)) {
        return next();
      }
    } else {
      // Fallback if plain object
      if (req.user.role === 'SUPER_ADMIN') {
        return next();
      }
      if (Array.isArray(req.user.permissions)) {
        if (
          req.user.permissions.includes('*') ||
          req.user.permissions.includes(permission) ||
          req.user.permissions.includes(`${permission.split('.')[0]}.*`)
        ) {
          return next();
        }
      }
    }

    return res.status(403).json({
      ok: false,
      code: 'PERMISSION_DENIED',
      message: `Access denied. Required permission: '${permission}'`,
      requiredPermission: permission,
    });
  };
};

const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      ok: false,
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }

  if (req.user.accountStatus !== 'ACTIVE') {
    return res.status(403).json({
      ok: false,
      code: 'ACCOUNT_INACTIVE',
      message: 'Account is suspended or inactive',
    });
  }

  const adminRoles = ['ADMIN', 'SUPER_ADMIN', 'MODERATOR', 'FINANCE_ADMIN'];
  const hasAdminRole = adminRoles.includes(req.user.role);
  const hasAdminPerm = Array.isArray(req.user.permissions) && req.user.permissions.length > 0;

  if (hasAdminRole || hasAdminPerm) {
    return next();
  }

  return res.status(403).json({
    ok: false,
    code: 'ADMIN_ACCESS_REQUIRED',
    message: 'Administrative privileges required',
  });
};

module.exports = {
  requirePermission,
  requireAdmin,
};

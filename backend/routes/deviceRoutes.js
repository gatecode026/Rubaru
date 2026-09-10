const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const { protect } = require('../middleware/auth');

router.use(protect);

/**
 * POST /v1/devices/register (and /v1/devices)
 * Authenticated persistent device registration
 */
const registerDeviceHandler = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      installationId,
      platform,
      pushToken,
      voipPushToken = null,
      provider = 'FCM',
      environment = 'DEVELOPMENT',
      appVersion = '1.0.0',
      deviceMetadata = {},
      permissionState = 'GRANTED',
    } = req.body || {};

    if (!installationId || typeof installationId !== 'string' || !installationId.trim()) {
      return res.status(400).json({ ok: false, code: 'INSTALLATION_ID_REQUIRED', message: 'installationId is required' });
    }
    if (!platform || typeof platform !== 'string') {
      return res.status(400).json({ ok: false, code: 'PLATFORM_REQUIRED', message: 'platform is required' });
    }
    if (!pushToken || typeof pushToken !== 'string' || !pushToken.trim()) {
      return res.status(400).json({ ok: false, code: 'PUSH_TOKEN_REQUIRED', message: 'pushToken is required' });
    }

    const normalizedPlatform = platform.toUpperCase();
    if (!['ANDROID', 'IOS', 'WEB'].includes(normalizedPlatform)) {
      return res.status(400).json({ ok: false, code: 'INVALID_PLATFORM', message: 'Platform must be ANDROID, IOS, or WEB' });
    }

    // Security rule: If pushToken or installationId was previously registered under a different user, revoke old ownership
    await Device.updateMany(
      {
        $or: [{ pushToken: pushToken.trim() }, { installationId: installationId.trim() }],
        user: { $ne: userId },
      },
      {
        status: 'REVOKED',
        invalidatedAt: new Date(),
      }
    );

    // Upsert device for this user + installationId
    let device = await Device.findOne({ user: userId, installationId: installationId.trim() });
    if (!device) {
      device = new Device({
        user: userId,
        installationId: installationId.trim(),
        platform: normalizedPlatform,
        pushToken: pushToken.trim(),
        voipPushToken: voipPushToken ? voipPushToken.trim() : null,
        provider,
        environment: environment ? environment.toUpperCase() : 'DEVELOPMENT',
        appVersion,
        deviceMetadata,
        permissionState,
        status: 'ACTIVE',
        lastSeenAt: new Date(),
      });
    } else {
      device.platform = normalizedPlatform;
      device.pushToken = pushToken.trim();
      if (voipPushToken) device.voipPushToken = voipPushToken.trim();
      device.provider = provider;
      device.environment = environment ? environment.toUpperCase() : 'DEVELOPMENT';
      device.appVersion = appVersion;
      device.deviceMetadata = deviceMetadata;
      device.permissionState = permissionState;
      device.status = 'ACTIVE';
      device.lastSeenAt = new Date();
      device.invalidatedAt = null;
    }

    await device.save();

    return res.status(200).json({
      ok: true,
      success: true,
      data: {
        id: device._id,
        installationId: device.installationId,
        platform: device.platform,
        provider: device.provider,
        status: device.status,
        permissionState: device.permissionState,
        lastSeenAt: device.lastSeenAt,
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, code: 'DEVICE_REGISTRATION_FAILED', message: err.message });
  }
};

router.post('/register', registerDeviceHandler);
router.post('/', registerDeviceHandler);

/**
 * PATCH /v1/devices/:installationId/token
 * Update push token for the user's installation
 */
router.patch('/:installationId/token', async (req, res) => {
  try {
    const userId = req.user._id;
    const { installationId } = req.params;
    const { pushToken, voipPushToken, provider } = req.body || {};

    if (!pushToken) {
      return res.status(400).json({ ok: false, code: 'PUSH_TOKEN_REQUIRED', message: 'pushToken is required' });
    }

    const device = await Device.findOne({ user: userId, installationId });
    if (!device) {
      return res.status(404).json({ ok: false, code: 'DEVICE_NOT_FOUND', message: 'Device not found' });
    }

    device.pushToken = pushToken.trim();
    if (voipPushToken !== undefined) device.voipPushToken = voipPushToken ? voipPushToken.trim() : null;
    if (provider) device.provider = provider;
    device.status = 'ACTIVE';
    device.lastSeenAt = new Date();
    await device.save();

    return res.json({ ok: true, success: true, message: 'Token updated', data: device });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

/**
 * PATCH /v1/devices/:installationId/permissions
 */
router.patch('/:installationId/permissions', async (req, res) => {
  try {
    const userId = req.user._id;
    const { installationId } = req.params;
    const { permissionState } = req.body || {};

    if (!permissionState) {
      return res.status(400).json({ ok: false, code: 'PERMISSION_STATE_REQUIRED', message: 'permissionState is required' });
    }

    const device = await Device.findOne({ user: userId, installationId });
    if (!device) {
      return res.status(404).json({ ok: false, code: 'DEVICE_NOT_FOUND', message: 'Device not found' });
    }

    device.permissionState = permissionState;
    device.lastSeenAt = new Date();
    await device.save();

    return res.json({ ok: true, success: true, message: 'Permissions updated', data: device });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

/**
 * DELETE /v1/devices/:installationId
 * Invalidate / Revoke device registration on logout
 */
const deleteDeviceHandler = async (req, res) => {
  try {
    const userId = req.user._id;
    const { installationId, deviceId } = req.params;
    const targetId = installationId || deviceId;

    const device = await Device.findOne({
      user: userId,
      $or: [{ installationId: targetId }, { _id: targetId.length === 24 ? targetId : null }, { deviceId: targetId }],
    });

    if (!device) {
      return res.status(404).json({ ok: false, code: 'DEVICE_NOT_FOUND', message: 'Device not found' });
    }

    device.status = 'REVOKED';
    device.invalidatedAt = new Date();
    await device.save();

    return res.json({ ok: true, success: true, message: 'Device registration revoked successfully' });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

router.delete('/:installationId', deleteDeviceHandler);
router.delete('/devices/:deviceId', deleteDeviceHandler);

/**
 * POST /v1/devices/:installationId/heartbeat
 */
router.post('/:installationId/heartbeat', async (req, res) => {
  try {
    const userId = req.user._id;
    const { installationId } = req.params;

    const device = await Device.findOne({ user: userId, installationId });
    if (!device) {
      return res.status(404).json({ ok: false, code: 'DEVICE_NOT_FOUND', message: 'Device not found' });
    }

    device.lastSeenAt = new Date();
    if (device.status === 'REVOKED' || device.status === 'EXPIRED') {
      device.status = 'ACTIVE';
      device.invalidatedAt = null;
    }
    await device.save();

    return res.json({ ok: true, success: true, data: { lastSeenAt: device.lastSeenAt, status: device.status } });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

module.exports = router;

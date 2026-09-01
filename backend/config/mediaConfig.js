// Centralized Media Configuration for Rubaru Social & Content Media Engine

module.exports = {
  configVersion: 'v1.0-media-foundation',

  // Feature Flag
  featureFlags: {
    socialMediaUploadEnabled: process.env.SOCIAL_MEDIA_UPLOAD_ENABLED !== 'false',
  },

  // Storage Configuration
  storage: {
    provider: process.env.MEDIA_STORAGE_PROVIDER || 'local', // 'local' | 's3' | 'r2' | 'gcs'
    localUploadDir: 'uploads/media',
    bucketName: process.env.MEDIA_STORAGE_BUCKET || 'rubaru-media-private',
    region: process.env.MEDIA_STORAGE_REGION || 'ap-south-1',
    cdnBaseUrl: process.env.MEDIA_CDN_BASE_URL || '',
    signedUploadTtlSeconds: 900,  // 15 minutes
    signedDownloadTtlSeconds: 3600, // 1 hour
  },

  // Allowed Purposes
  allowedPurposes: [
    'PROFILE_PHOTO',
    'POST_MEDIA',
    'REEL_VIDEO',
    'STORY_MEDIA',
    'CHAT_ATTACHMENT',
  ],

  // Allowed Media Types
  allowedMediaTypes: ['IMAGE', 'VIDEO', 'AUDIO'],

  // MIME Allowlist
  allowedMimeTypes: {
    IMAGE: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
    ],
    VIDEO: [
      'video/mp4',
      'video/quicktime', // .mov
      'video/webm',
    ],
    AUDIO: [
      'audio/mpeg',
      'audio/mp3',
      'audio/m4a',
      'audio/aac',
      'audio/wav',
      'audio/ogg',
    ],
  },

  // File Extensions Allowlist
  allowedExtensions: {
    IMAGE: ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'],
    VIDEO: ['.mp4', '.mov', '.webm'],
    AUDIO: ['.mp3', '.m4a', '.aac', '.wav', '.ogg'],
  },

  // Size Limits (Bytes)
  limits: {
    maxImageBytes: 15 * 1024 * 1024,   // 15MB
    maxVideoBytes: 150 * 1024 * 1024,  // 150MB
    maxAudioBytes: 25 * 1024 * 1024,   // 25MB
    maxVideoDurationMs: 90 * 1000,     // 90 seconds (Reels max)
    maxStoryDurationMs: 15 * 1000,     // 15 seconds (Story segment max)
    maxImageDimensionPx: 4096,         // 4K max dimension
    maxVideoDimensionPx: 2160,         // 1080x1920 portrait HD
    uploadSessionTtlMinutes: 15,
    processingTimeoutMs: 60 * 1000,    // 60s processing timeout
    orphanCleanupHours: 24,            // Unfinalized uploads older than 24h cleaned up
    maxConcurrentUploadsPerUser: 10,
  },

  // Variant Profiles
  variantProfiles: {
    IMAGE: [
      { name: 'thumbnail', maxWidth: 300, maxHeight: 300, quality: 80, format: 'webp' },
      { name: 'medium', maxWidth: 1080, maxHeight: 1350, quality: 85, format: 'webp' },
      { name: 'large', maxWidth: 2048, maxHeight: 2560, quality: 90, format: 'webp' },
    ],
    VIDEO: [
      { name: 'thumbnail', timestampSec: 1, maxWidth: 480, format: 'jpeg' },
      { name: 'preview_720p', height: 720, videoBitrateKbps: 1500, audioBitrateKbps: 128, format: 'mp4' },
      { name: 'hd_1080p', height: 1080, videoBitrateKbps: 3500, audioBitrateKbps: 192, format: 'mp4' },
    ],
  },
};

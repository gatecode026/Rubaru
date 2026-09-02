/**
 * Rubaru Social & Content Media Foundation Types
 */

export const MediaPurpose = {
  PROFILE_PHOTO: 'PROFILE_PHOTO',
  POST_MEDIA: 'POST_MEDIA',
  REEL_VIDEO: 'REEL_VIDEO',
  STORY_MEDIA: 'STORY_MEDIA',
  CHAT_ATTACHMENT: 'CHAT_ATTACHMENT',
};

export const MediaType = {
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
  AUDIO: 'AUDIO',
};

export const MediaProcessingStatus = {
  PENDING_UPLOAD: 'PENDING_UPLOAD',
  UPLOADED: 'UPLOADED',
  VERIFYING: 'VERIFYING',
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  FAILED: 'FAILED',
  DELETING: 'DELETING',
  DELETED: 'DELETED',
};

export const MediaUploadState = {
  IDLE: 'idle',
  PREPARING: 'preparing',
  UPLOADING: 'uploading',
  FINALIZING: 'finalizing',
  PROCESSING: 'processing',
  READY: 'ready',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

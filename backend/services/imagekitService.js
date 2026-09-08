const fs = require('fs');
const path = require('path');
const { imagekit, FOLDERS } = require('../config/imagekitConfig');

/**
 * Enterprise ImageKit Service for Rubaru Media Cloud
 * Direct CDN offloading for images, posts, stories, avatars, and short-form videos.
 */
class ImageKitService {
  constructor() {
    this.client = imagekit;
    this.FOLDERS = FOLDERS;
  }

  /**
   * Upload an in-memory buffer to ImageKit
   * @param {Buffer} buffer - File buffer
   * @param {string} fileName - Destination file name
   * @param {string} folder - Target ImageKit directory
   * @param {Array<string>} tags - Search/organization tags
   * @returns {Promise<Object>} ImageKit upload result
   */
  async uploadBuffer(buffer, fileName, folder = FOLDERS.MEDIA, tags = []) {
    if (!buffer) {
      throw new Error('Upload buffer cannot be empty.');
    }

    const cleanFileName = (fileName || `rubaru_${Date.now()}`).replace(/[^a-zA-Z0-9_.-]/g, '_');

    try {
      const response = await this.client.upload({
        file: buffer,
        fileName: cleanFileName,
        folder: folder,
        tags: Array.isArray(tags) ? tags : [tags],
        useUniqueFileName: true,
      });

      return {
        success: true,
        fileId: response.fileId,
        name: response.name,
        url: response.url,
        filePath: response.filePath,
        size: response.size,
        fileType: response.fileType,
        height: response.height || null,
        width: response.width || null,
        thumbnailUrl: response.thumbnailUrl || response.url,
      };
    } catch (err) {
      console.error('[IMAGEKIT UPLOAD ERROR]:', err.message || err);
      throw new Error(`Failed to upload to ImageKit: ${err.message || 'Unknown error'}`);
    }
  }

  /**
   * Upload a local file from disk to ImageKit and optionally unlink the local file
   * @param {string} localFilePath - Path to local file
   * @param {string} fileName - Destination file name
   * @param {string} folder - Target ImageKit directory
   * @param {Array<string>} tags - Search/organization tags
   * @param {boolean} deleteAfter - Whether to delete the local file after upload
   * @returns {Promise<Object>} ImageKit upload result
   */
  async uploadLocalFile(localFilePath, fileName, folder = FOLDERS.MEDIA, tags = [], deleteAfter = true) {
    if (!fs.existsSync(localFilePath)) {
      throw new Error(`Local file not found for ImageKit upload: ${localFilePath}`);
    }

    const buffer = fs.readFileSync(localFilePath);
    const chosenName = fileName || path.basename(localFilePath);

    try {
      const result = await this.uploadBuffer(buffer, chosenName, folder, tags);

      // Clean up temporary local file if requested
      if (deleteAfter) {
        try {
          fs.unlinkSync(localFilePath);
        } catch (cleanupErr) {
          console.warn('[IMAGEKIT CLEANUP WARNING] Could not remove temp file:', cleanupErr.message);
        }
      }

      return result;
    } catch (err) {
      if (deleteAfter && fs.existsSync(localFilePath)) {
        try {
          fs.unlinkSync(localFilePath);
        } catch (e) {}
      }
      throw err;
    }
  }

  /**
   * Delete a media asset from ImageKit by fileId
   * @param {string} fileId - ImageKit file ID
   */
  async deleteFile(fileId) {
    if (!fileId) return false;
    try {
      await this.client.deleteFile(fileId);
      return true;
    } catch (err) {
      console.warn(`[IMAGEKIT DELETE WARNING] Could not delete file ${fileId}:`, err.message);
      return false;
    }
  }

  /**
   * Get secure client authentication parameters for client-side uploads
   */
  getAuthenticationParameters() {
    return this.client.getAuthenticationParameters();
  }

  /**
   * Generate an optimized transformation URL from ImageKit
   * @param {string} pathOrUrl - File path or full URL
   * @param {Array<Object>} transformation - Transformation options
   */
  url(options) {
    return this.client.url(options);
  }
}

const imagekitService = new ImageKitService();

module.exports = imagekitService;

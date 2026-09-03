const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mediaConfig = require('../../config/mediaConfig');

/**
 * Storage Provider Factory & Adapter Interface
 * Provides unified API for Local Disk and Cloud Object Storage (S3/R2/GCS).
 */
class LocalDiskStorageProvider {
  constructor() {
    this.baseDir = path.join(__dirname, '../../..', mediaConfig.storage.localUploadDir);
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  _resolveLocalPath(objectKey) {
    // Prevent path traversal
    const safeKey = objectKey.replace(/\.\./g, '');
    return path.join(this.baseDir, safeKey);
  }

  async createUploadAuthorization({ objectKey, declaredMimeType, maxSizeBytes, expiresAt }) {
    const safePath = this._resolveLocalPath(objectKey);
    const dir = path.dirname(safePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // In local/staging mode, upload directly to the server's scoped media upload endpoint
    const uploadUrl = `/v1/media/upload-direct/${encodeURIComponent(objectKey)}`;

    return {
      uploadUrl,
      objectKey,
      method: 'PUT',
      headers: {
        'Content-Type': declaredMimeType,
        'Content-Length': maxSizeBytes ? maxSizeBytes.toString() : undefined,
      },
      expiresAt,
      provider: 'local',
    };
  }

  async objectExists(objectKey) {
    const fullPath = this._resolveLocalPath(objectKey);
    return fs.existsSync(fullPath);
  }

  async inspectObject(objectKey) {
    const fullPath = this._resolveLocalPath(objectKey);
    if (!fs.existsSync(fullPath)) {
      return { exists: false, sizeBytes: 0, mimeType: null, checksum: null, lastModified: null };
    }

    const stats = fs.statSync(fullPath);
    
    // Calculate SHA-256 checksum
    const fileBuffer = fs.readFileSync(fullPath);
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Detect MIME type by magic numbers
    const detectedMime = this._detectMimeFromBuffer(fileBuffer);

    return {
      exists: true,
      sizeBytes: stats.size,
      mimeType: detectedMime,
      checksum,
      lastModified: stats.mtime,
    };
  }

  async readObjectBuffer(objectKey, maxBytes = null) {
    const fullPath = this._resolveLocalPath(objectKey);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Object not found: ${objectKey}`);
    }

    if (maxBytes && maxBytes > 0) {
      const fd = fs.openSync(fullPath, 'r');
      const buf = Buffer.alloc(maxBytes);
      const bytesRead = fs.readSync(fd, buf, 0, maxBytes, 0);
      fs.closeSync(fd);
      return buf.subarray(0, bytesRead);
    }

    return fs.readFileSync(fullPath);
  }

  async writeObject(objectKey, buffer, mimeType) {
    const fullPath = this._resolveLocalPath(objectKey);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, buffer);
    return {
      objectKey,
      sizeBytes: buffer.length,
      mimeType,
    };
  }

  async deleteObject(objectKey) {
    const fullPath = this._resolveLocalPath(objectKey);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  async createReadAuthorization(objectKey, expiresInSec = 3600) {
    if (mediaConfig.storage.cdnBaseUrl) {
      return `${mediaConfig.storage.cdnBaseUrl}/${objectKey}`;
    }
    return `/${mediaConfig.storage.localUploadDir}/${objectKey}`;
  }

  _detectMimeFromBuffer(buffer) {
    if (!buffer || buffer.length < 4) return 'application/octet-stream';

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }

    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return 'image/png';
    }

    // WebP or WAV: RIFF container
    if (buffer.length >= 12 && buffer.toString('utf8', 0, 4) === 'RIFF') {
      if (buffer.toString('utf8', 8, 12) === 'WEBP') {
        return 'image/webp';
      }
      if (buffer.toString('utf8', 8, 12) === 'WAVE') {
        return 'audio/wav';
      }
    }

    // GIF: 47 49 46 38
    if (buffer.toString('utf8', 0, 4) === 'GIF8') {
      return 'image/gif';
    }

    // MP4 / MOV / M4A: ftyp box at byte 4-8
    if (buffer.length >= 12 && buffer.toString('utf8', 4, 8) === 'ftyp') {
      const brand = buffer.toString('utf8', 8, 12);
      if (brand.startsWith('M4A') || brand.startsWith('m4a')) {
        return 'audio/m4a';
      }
      if (brand.startsWith('qt')) {
        return 'video/quicktime';
      }
      return 'video/mp4';
    }

    // WebM / Matroska: 1A 45 DF A3
    if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
      return 'video/webm';
    }

    // Audio OGG / Opus: OggS
    if (buffer.toString('utf8', 0, 4) === 'OggS') {
      return 'audio/ogg';
    }

    // Audio MP3: ID3 header or sync word FF FB / FF FA / FF F3 / FF F2
    if (buffer.toString('utf8', 0, 3) === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) {
      return 'audio/mpeg';
    }

    return 'application/octet-stream';
  }
}

// Singleton storage provider instance
const storageProvider = new LocalDiskStorageProvider();

module.exports = storageProvider;

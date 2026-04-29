const path = require('path');
const fs = require('fs');
const { UPLOAD_PATH } = require('../config/env');

/**
 * Generate secure file path for original video
 * Format: uploads/{tenantId}/{videoId}_original.{ext}
 */
const getOriginalFilePath = (tenantId, videoId, extension = 'mp4') => {
  return path.join(UPLOAD_PATH, tenantId, `${videoId}_original.${extension}`);
};

/**
 * Generate secure file path for processed video
 * Format: uploads/{tenantId}/{videoId}_processed.{ext}
 */
const getProcessedFilePath = (tenantId, videoId, extension = 'mp4') => {
  return path.join(UPLOAD_PATH, tenantId, `${videoId}_processed.${extension}`);
};

/**
 * Generate secure file path for thumbnail
 * Format: uploads/{tenantId}/{videoId}_thumbnail.{ext}
 */
const getThumbnailPath = (tenantId, videoId, extension = 'jpg') => {
  return path.join(UPLOAD_PATH, tenantId, `${videoId}_thumbnail.${extension}`);
};

/**
 * Ensure tenant directory exists
 */
const ensureTenantDirectory = (tenantId) => {
  const tenantDir = path.join(UPLOAD_PATH, tenantId);
  if (!fs.existsSync(tenantDir)) {
    fs.mkdirSync(tenantDir, { recursive: true });
  }
  return tenantDir;
};

/**
 * Rename file to secure naming convention
 * @param {string} oldPath - Current file path
 * @param {string} newPath - New file path
 * @returns {Promise<string>} - New file path
 */
const renameToSecurePath = async (oldPath, newPath) => {
  return new Promise((resolve, reject) => {
    // Ensure directory exists
    const dir = path.dirname(newPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.rename(oldPath, newPath, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(newPath);
      }
    });
  });
};

/**
 * Get file extension from filename or path
 */
const getFileExtension = (filename) => {
  return path.extname(filename).toLowerCase().slice(1);
};

/**
 * Delete file safely
 */
const deleteFile = (filePath) => {
  return new Promise((resolve, reject) => {
    if (!filePath || !fs.existsSync(filePath)) {
      resolve(); // File doesn't exist, consider it deleted
      return;
    }

    fs.unlink(filePath, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

/**
 * Delete all files associated with a video
 */
const deleteVideoFiles = async (video) => {
  const filesToDelete = [];
  
  if (video.originalFilePath) {
    filesToDelete.push(deleteFile(video.originalFilePath));
  }
  
  if (video.processedFilePath) {
    filesToDelete.push(deleteFile(video.processedFilePath));
  }
  
  if (video.thumbnailPath) {
    filesToDelete.push(deleteFile(video.thumbnailPath));
  }
  
  // Legacy filePath support
  if (video.filePath && video.filePath !== video.originalFilePath) {
    filesToDelete.push(deleteFile(video.filePath));
  }

  await Promise.allSettled(filesToDelete);
};

module.exports = {
  getOriginalFilePath,
  getProcessedFilePath,
  getThumbnailPath,
  ensureTenantDirectory,
  renameToSecurePath,
  getFileExtension,
  deleteFile,
  deleteVideoFiles
};




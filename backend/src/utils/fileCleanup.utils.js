const fs = require('fs').promises;
const path = require('path');
const Video = require('../models/Video');
const { deleteVideoFiles } = require('./fileStorage.utils');

/**
 * Cleanup uploaded file on error
 * @param {string} filePath - Path to file to delete
 */
const cleanupUploadedFile = async (filePath) => {
  if (!filePath) return;

  try {
    await fs.unlink(filePath);
    console.log(`Cleaned up uploaded file: ${filePath}`);
  } catch (error) {
    // File might not exist, ignore error
    if (error.code !== 'ENOENT') {
      console.error(`Error cleaning up file ${filePath}:`, error);
    }
  }
};

/**
 * Cleanup video record and associated files on error
 * @param {string} videoId - Video ID to cleanup
 */
const cleanupVideoRecord = async (videoId) => {
  try {
    const video = await Video.findById(videoId);
    if (video) {
      // Delete associated files
      await deleteVideoFiles(video);
      
      // Delete video record
      await Video.findByIdAndDelete(videoId);
      console.log(`Cleaned up video record: ${videoId}`);
    }
  } catch (error) {
    console.error(`Error cleaning up video record ${videoId}:`, error);
  }
};

/**
 * Cleanup temporary files
 * @param {Array<string>} filePaths - Array of file paths to delete
 */
const cleanupTempFiles = async (filePaths) => {
  if (!Array.isArray(filePaths)) {
    filePaths = [filePaths];
  }

  const cleanupPromises = filePaths
    .filter(Boolean)
    .map(filePath => cleanupUploadedFile(filePath));

  await Promise.allSettled(cleanupPromises);
};

/**
 * Cleanup directory
 * @param {string} dirPath - Directory path to remove
 */
const cleanupDirectory = async (dirPath) => {
  if (!dirPath) return;

  try {
    await fs.rmdir(dirPath, { recursive: true });
    console.log(`Cleaned up directory: ${dirPath}`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`Error cleaning up directory ${dirPath}:`, error);
    }
  }
};

module.exports = {
  cleanupUploadedFile,
  cleanupVideoRecord,
  cleanupTempFiles,
  cleanupDirectory
};




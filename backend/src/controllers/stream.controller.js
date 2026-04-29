const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const Video = require('../models/Video');
const { tenantQuery } = require('../middlewares/tenant.middleware');
const { asyncHandler, NotFoundError, ForbiddenError, UnauthorizedError } = require('../middlewares/errorHandler.middleware');

/**
 * Verify JWT token from query parameter or header
 * Used for video streaming where custom headers aren't always available
 */
const verifyToken = (req) => {
  // Try query parameter first (for video element src)
  const tokenFromQuery = req.query.token;
  const tokenFromHeader = req.headers.authorization?.split(' ')[1];
  const token = tokenFromQuery || tokenFromHeader;

  if (!token) {
    return null;
  }

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

/**
 * Parse Range header
 * @param {string} rangeHeader - Range header value (e.g., "bytes=0-1023")
 * @param {number} fileSize - Total file size in bytes
 * @returns {Object|null} - { start, end, chunkSize } or null if invalid
 */
const parseRange = (rangeHeader, fileSize) => {
  if (!rangeHeader) {
    return null;
  }

  // Extract byte range from header (e.g., "bytes=0-1023")
  const matches = rangeHeader.match(/bytes=(\d+)-(\d*)/);
  if (!matches) {
    return null;
  }

  const start = parseInt(matches[1], 10);
  let end = matches[2] ? parseInt(matches[2], 10) : fileSize - 1;

  // Validate range
  if (isNaN(start) || isNaN(end) || start > end || start < 0 || end >= fileSize) {
    return null;
  }

  // Adjust end if it exceeds file size
  end = Math.min(end, fileSize - 1);

  const chunkSize = end - start + 1;

  return { start, end, chunkSize };
};

/**
 * Get MIME type from file extension
 * @param {string} filePath - File path
 * @returns {string} - MIME type
 */
const getMimeType = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.mp4': 'video/mp4',
    '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime'
  };
  return mimeTypes[ext] || 'video/mp4';
};

/**
 * Stream video with HTTP Range Request support
 * @route   GET /api/stream/:videoId
 * @access  Private
 */
const streamVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  
  // Verify token (from query param or header)
  const decoded = verifyToken(req);
  if (!decoded) {
    throw new UnauthorizedError('Authentication required');
  }

  const tenantId = decoded.tenantId;

  // Find video and ensure tenant access
  const video = await Video.findOne(tenantQuery(tenantId, { _id: videoId }));

  if (!video) {
    throw new NotFoundError('Video');
  }

  // Check if video is ready for streaming
  // Allow streaming for any status except when still uploading/processing
  if (video.status === 'uploaded' || video.status === 'processing') {
    throw new ForbiddenError('Video is not ready for streaming');
  }

  // Determine which file to stream (prefer processed, fallback to original)
  const filePath = video.processedFilePath || video.originalFilePath;
  
  if (!filePath || !fs.existsSync(filePath)) {
    throw new NotFoundError('Video file');
  }

  // Get file stats
  const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    const mimeType = video.mimeType || getMimeType(filePath);

    // Parse Range header
    const range = parseRange(req.headers.range, fileSize);

    // Set headers
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', range ? range.chunkSize : fileSize);

    // If no Range header, send entire file
    if (!range) {
      res.setHeader('Content-Range', `bytes 0-${fileSize - 1}/${fileSize}`);
      res.status(200);
      
      // Stream entire file
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
      return;
    }

    // Send partial content (206)
    res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${fileSize}`);
    res.status(206); // Partial Content

    // Create read stream for the requested range
    const fileStream = fs.createReadStream(filePath, {
      start: range.start,
      end: range.end
    });

    // Handle stream errors
    fileStream.on('error', (error) => {
      console.error('Stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error streaming video'
        });
      }
    });

    // Pipe the chunk to response
    fileStream.pipe(res);
});

/**
 * Get video stream info (for preloading/initialization)
 * @route   HEAD /api/stream/:videoId
 * @access  Private
 */
const getStreamInfo = async (req, res) => {
  try {
    const { videoId } = req.params;
    
    // Verify token (from query param or header)
    const decoded = verifyToken(req);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const tenantId = decoded.tenantId;

    // Find video and ensure tenant access
    const video = await Video.findOne(tenantQuery(tenantId, { _id: videoId }));

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found or access denied'
      });
    }

    // Determine which file to stream
    const filePath = video.processedFilePath || video.originalFilePath;
    
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Video file not found'
      });
    }

    // Get file stats
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    const mimeType = video.mimeType || getMimeType(filePath);

    // Set headers for HEAD request
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', fileSize);
    res.status(200).end();

  } catch (error) {
    console.error('Get stream info error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

module.exports = {
  streamVideo,
  getStreamInfo
};

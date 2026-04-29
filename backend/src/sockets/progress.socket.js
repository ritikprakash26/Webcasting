const Video = require('../models/Video');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');

/**
 * Socket.io authentication middleware
 */
const authenticateSocket = (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.userId;
      socket.user = {
        userId: decoded.userId,
        role: decoded.role,
        tenantId: decoded.tenantId
      };
      next();
    } catch (error) {
      // Handle specific JWT errors
      if (error.name === 'TokenExpiredError') {
        return next(new Error('Token has expired. Please login again.'));
      }
      if (error.name === 'JsonWebTokenError') {
        return next(new Error('Invalid authentication token'));
      }
      return next(new Error('Authentication failed'));
    }
  } catch (error) {
    next(new Error('Authentication failed'));
  }
};

/**
 * Initialize Socket.io progress handlers
 * @param {Server} io - Socket.io server instance
 */
const initializeProgressSocket = (io) => {
  // Namespace for video processing progress
  const progressNamespace = io.of('/progress');

  // Apply authentication middleware
  progressNamespace.use(authenticateSocket);

  progressNamespace.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`Client connected to progress namespace: ${socket.id} (User: ${userId})`);

    // Join user's personal room for progress updates
    const userRoom = `user:${userId}`;
    socket.join(userRoom);
    console.log(`Client ${socket.id} joined user room: ${userRoom}`);

    // Join room for specific video progress updates
    socket.on('join-video-room', async (videoId) => {
      try {
        // Verify video exists and user has access
        const video = await Video.findById(videoId);
        if (!video) {
          socket.emit('error', { message: 'Video not found' });
          return;
        }

        // Check if user has access to this video (same tenant)
        if (video.tenantId !== socket.user.tenantId) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        const room = `video:${videoId}`;
        socket.join(room);
        console.log(`Client ${socket.id} joined room: ${room}`);

        // Send current video status
        socket.emit('video-status', {
          videoId,
          status: video.status,
          progress: video.processingProgress,
          message: getStatusMessage(video.status)
        });
      } catch (error) {
        console.error('Error joining video room:', error);
        socket.emit('error', { message: 'Failed to join video room' });
      }
    });

    // Leave video room
    socket.on('leave-video-room', (videoId) => {
      const room = `video:${videoId}`;
      socket.leave(room);
      console.log(`Client ${socket.id} left room: ${room}`);
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected from progress namespace: ${socket.id} (User: ${userId})`);
    });
  });

  return progressNamespace;
};

/**
 * Emit progress update to specific user
 * @param {Server} io - Socket.io server instance
 * @param {string} userId - User ID
 * @param {string} videoId - Video ID
 * @param {number} percent - Progress percentage (0-100)
 * @param {string} status - Current status
 * @param {string} message - Optional progress message
 */
const emitProgressToUser = (io, userId, videoId, percent, status, message = null) => {
  const progressNamespace = io.of('/progress');
  const userRoom = `user:${userId}`;
  
  progressNamespace.to(userRoom).emit('progress', {
    videoId,
    percent,
    status,
    message: message || getStatusMessage(status),
    timestamp: new Date().toISOString()
  });
};

/**
 * Emit progress update to all clients in video room
 * @param {Server} io - Socket.io server instance
 * @param {string} videoId - Video ID
 * @param {number} progress - Progress percentage (0-100)
 * @param {string} message - Progress message
 */
const emitProgress = (io, videoId, progress, message) => {
  const progressNamespace = io.of('/progress');
  const room = `video:${videoId}`;
  
  progressNamespace.to(room).emit('processing-progress', {
    videoId,
    progress,
    message,
    timestamp: new Date().toISOString()
  });
};

/**
 * Emit status update to specific user
 * @param {Server} io - Socket.io server instance
 * @param {string} userId - User ID
 * @param {string} videoId - Video ID
 * @param {string} status - New status
 * @param {Object} data - Additional data
 */
const emitStatusUpdateToUser = (io, userId, videoId, status, data = {}) => {
  const progressNamespace = io.of('/progress');
  const userRoom = `user:${userId}`;
  
  progressNamespace.to(userRoom).emit('progress', {
    videoId,
    percent: data.progress || 100,
    status,
    message: getStatusMessage(status),
    ...data,
    timestamp: new Date().toISOString()
  });
};

/**
 * Emit status update to all clients in video room
 * @param {Server} io - Socket.io server instance
 * @param {string} videoId - Video ID
 * @param {string} status - New status
 * @param {Object} data - Additional data
 */
const emitStatusUpdate = (io, videoId, status, data = {}) => {
  const progressNamespace = io.of('/progress');
  const room = `video:${videoId}`;
  
  progressNamespace.to(room).emit('status-update', {
    videoId,
    status,
    message: getStatusMessage(status),
    ...data,
    timestamp: new Date().toISOString()
  });
};

/**
 * Get human-readable status message
 */
const getStatusMessage = (status) => {
  const messages = {
    uploaded: 'Video uploaded successfully',
    processing: 'Processing video...',
    safe: 'Content verified as safe',
    flagged: 'Content flagged for review',
    ready: 'Video is ready for viewing',
    failed: 'Processing failed'
  };
  return messages[status] || 'Unknown status';
};

module.exports = {
  initializeProgressSocket,
  emitProgress,
  emitProgressToUser,
  emitStatusUpdate,
  emitStatusUpdateToUser
};

const { processVideo } = require('./videoProcessing.service');
const { emitProgress, emitProgressToUser, emitStatusUpdate, emitStatusUpdateToUser } = require('../sockets/progress.socket');
const Video = require('../models/Video');

// Helper function to get status message
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

// Simple in-memory queue (for production, use Redis/Bull/BullMQ)
const processingQueue = [];
let isProcessing = false;
let currentVideoId = null;

/**
 * Add video to processing queue
 * @param {string} videoId - Video ID to process
 * @param {Server} io - Socket.io server instance
 */
const addToQueue = (videoId, io) => {
  processingQueue.push({ videoId, io });
  console.log(`Video ${videoId} added to processing queue. Queue length: ${processingQueue.length}`);
  
  // Start processing if not already processing
  if (!isProcessing) {
    processNext();
  }
};

/**
 * Process next video in queue
 */
const processNext = async () => {
  if (isProcessing || processingQueue.length === 0) {
    return;
  }

  isProcessing = true;
  const { videoId, io } = processingQueue.shift();
  currentVideoId = videoId;

  try {
    console.log(`Starting processing for video: ${videoId}`);

    // Get video to find userId
    const video = await Video.findById(videoId);
    const userId = video?.uploadedBy?.toString();

    // Emit initial status update to user and video room
    if (io) {
      const initialData = {
        progress: 0,
        message: 'Processing started'
      };
      
      emitStatusUpdate(io, videoId, 'processing', initialData);
      
      // Emit to specific user
      if (userId) {
        emitProgressToUser(io, userId, videoId, 0, 'processing', 'Processing started');
      }
    }

    // Progress callback that emits Socket.io events
    // Capture userId in closure
    const progressCallback = (progress, message) => {
      if (io) {
        // Emit to video room
        emitProgress(io, videoId, progress, message);
        
        // Emit to specific user
        if (userId) {
          emitProgressToUser(io, userId, videoId, progress, 'processing', message);
        }
      }
    };

    // Process video
    const result = await processVideo(videoId, progressCallback);

    // Emit final status update (safe or flagged)
    if (io) {
      const finalData = {
        progress: 100,
        sensitivityLevel: result.video.sensitivityLevel
      };
      
      // Emit to video room
      emitStatusUpdate(io, videoId, result.video.status, finalData);
      
      // Emit to specific user
      if (userId) {
        emitProgressToUser(io, userId, videoId, 100, result.video.status, getStatusMessage(result.video.status));
      }

      // Emit ready status after a delay
      setTimeout(() => {
        emitStatusUpdate(io, videoId, 'ready', finalData);
        
        if (userId) {
          emitProgressToUser(io, userId, videoId, 100, 'ready', 'Video is ready for viewing');
        }
      }, 1000);
    }

    console.log(`Processing completed for video: ${videoId}, Status: ${result.video.status}`);
  } catch (error) {
    console.error(`Processing failed for video ${videoId}:`, error);
    
    // Get video to find userId for error notification
    try {
      const video = await Video.findById(videoId).populate('uploadedBy');
      const userId = video?.uploadedBy?._id?.toString() || video?.uploadedBy?.toString();
      
      // Emit error status
      if (io) {
        emitStatusUpdate(io, videoId, 'failed', {
          error: error.message
        });
        
        if (userId) {
          emitProgressToUser(io, userId, videoId, 0, 'failed', `Processing failed: ${error.message}`);
        }
      }
    } catch (err) {
      console.error('Error emitting failure status:', err);
    }
  } finally {
    isProcessing = false;
    currentVideoId = null;
    
    // Process next item in queue
    if (processingQueue.length > 0) {
      setImmediate(() => processNext());
    }
  }
};

/**
 * Get queue status
 */
const getQueueStatus = () => {
  return {
    queueLength: processingQueue.length,
    isProcessing,
    currentVideo: currentVideoId
  };
};

module.exports = {
  addToQueue,
  getQueueStatus
};

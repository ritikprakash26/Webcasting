const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');
const path = require('path');
const fs = require('fs');
const Video = require('../models/Video');
const { getProcessedFilePath, getThumbnailPath, getFileExtension } = require('../utils/fileStorage.utils');
const { processSensitivityCheck } = require('./sensitivity.service');
const {
  ENABLE_COMPRESSION,
  VIDEO_CRF,
  VIDEO_PRESET,
  VIDEO_MAX_RESOLUTION,
  VIDEO_BITRATE,
  AUDIO_BITRATE
} = require('../config/env');

// Set FFmpeg and ffprobe paths (use static binaries)
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

if (ffprobeStatic && ffprobeStatic.path) {
  ffmpeg.setFfprobePath(ffprobeStatic.path);
}

/**
 * Process video: transcode, generate thumbnail, check sensitivity
 * @param {string} videoId - Video document ID
 * @param {Function} progressCallback - Callback for progress updates (progress: number, message: string)
 * @returns {Promise<Object>} - Processing result
 */
const processVideo = async (videoId, progressCallback = null) => {
  try {
    // Get video from database
    const video = await Video.findById(videoId);
    if (!video) {
      throw new Error('Video not found');
    }

    const tenantId = video.tenantId;
    const originalPath = video.originalFilePath;

    if (!fs.existsSync(originalPath)) {
      throw new Error('Original video file not found');
    }

    // Update status to processing
    video.status = 'processing';
    video.processingProgress = 0;
    await video.save();

    if (progressCallback) {
      progressCallback(10, 'Starting video processing...');
    }

    // Get file extension
    const ext = getFileExtension(originalPath) || 'mp4';
    const processedPath = getProcessedFilePath(tenantId, videoId, ext);
    const thumbnailPath = getThumbnailPath(tenantId, videoId, 'jpg');

    // Ensure directory exists
    const dir = path.dirname(processedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Step 1: Transcode video (30% of progress)
    await transcodeVideo(originalPath, processedPath, (progress) => {
      const overallProgress = 10 + Math.floor(progress * 0.3);
      if (progressCallback) {
        progressCallback(overallProgress, `Transcoding video... ${Math.floor(progress)}%`);
      }
    });

    if (progressCallback) {
      progressCallback(40, 'Video transcoded successfully');
    }

    // Step 2: Generate thumbnail (20% of progress)
    await generateThumbnail(processedPath, thumbnailPath, (progress) => {
      const overallProgress = 40 + Math.floor(progress * 0.2);
      if (progressCallback) {
        progressCallback(overallProgress, `Generating thumbnail... ${Math.floor(progress)}%`);
      }
    });

    if (progressCallback) {
      progressCallback(60, 'Thumbnail generated');
    }

    // Step 3: Get video metadata (10% of progress)
    const metadata = await getVideoMetadata(processedPath);
    video.duration = metadata.duration;
    await video.save();

    if (progressCallback) {
      progressCallback(70, 'Video metadata extracted');
    }

    // Step 4: Sensitivity check (20% of progress)
    if (progressCallback) {
      progressCallback(70, 'Checking content sensitivity...');
    }

    const sensitivityResult = await processSensitivityCheck(processedPath, (progress) => {
      const overallProgress = 70 + Math.floor(progress * 0.2);
      if (progressCallback) {
        progressCallback(overallProgress, `Analyzing content... ${Math.floor(progress)}%`);
      }
    });

    // Update video with processing results
    video.processedFilePath = processedPath;
    video.thumbnailPath = thumbnailPath;
    video.sensitivityLevel = sensitivityResult.level;
    video.processingProgress = 100;

    // Set status based on sensitivity check
    if (sensitivityResult.flagged) {
      video.status = 'flagged';
    } else {
      video.status = 'safe';
    }

    await video.save();

    if (progressCallback) {
      progressCallback(100, 'Processing complete');
    }

    // Final status update to 'ready' after a short delay
    setTimeout(async () => {
      const updatedVideo = await Video.findById(videoId);
      if (updatedVideo && (updatedVideo.status === 'safe' || updatedVideo.status === 'flagged')) {
        updatedVideo.status = 'ready';
        await updatedVideo.save();
      }
    }, 1000);

    return {
      success: true,
      video: video.toObject(),
      sensitivityResult
    };
  } catch (error) {
    console.error('Video processing error:', error);
    
    // Update video status to failed
    try {
      const video = await Video.findById(videoId);
      if (video) {
        video.status = 'failed';
        await video.save();
      }
    } catch (updateError) {
      console.error('Error updating video status:', updateError);
    }

    // Cleanup processed files on failure
    try {
      const video = await Video.findById(videoId);
      if (video) {
        const { deleteVideoFiles } = require('../utils/fileStorage.utils');
        // Only delete processed files, keep original
        if (video.processedFilePath) {
          const { deleteFile } = require('../utils/fileStorage.utils');
          await deleteFile(video.processedFilePath);
        }
        if (video.thumbnailPath) {
          const { deleteFile } = require('../utils/fileStorage.utils');
          await deleteFile(video.thumbnailPath);
        }
      }
    } catch (cleanupError) {
      console.error('Error cleaning up processed files:', cleanupError);
    }

    throw error;
  }
};

/**
 * Transcode video to streaming-optimized format
 * Generates MP4 with H.264 codec optimized for web streaming
 */
const transcodeVideo = (inputPath, outputPath, progressCallback = null) => {
  return new Promise((resolve, reject) => {
    // Get video metadata to determine if scaling is needed
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        return reject(new Error(`Failed to get video metadata: ${err.message}`));
      }

      const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
      const width = videoStream?.width || 1920;
      const height = videoStream?.height || 1080;

      // Parse max resolution
      const [maxWidth, maxHeight] = VIDEO_MAX_RESOLUTION.split('x').map(Number);
      
      // Calculate scaling if needed
      let scaleFilter = null;
      if (width > maxWidth || height > maxHeight) {
        // Maintain aspect ratio
        const aspectRatio = width / height;
        let newWidth = maxWidth;
        let newHeight = Math.round(maxWidth / aspectRatio);
        
        if (newHeight > maxHeight) {
          newHeight = maxHeight;
          newWidth = Math.round(maxHeight * aspectRatio);
        }
        
        // Ensure even dimensions (required for H.264)
        newWidth = newWidth % 2 === 0 ? newWidth : newWidth - 1;
        newHeight = newHeight % 2 === 0 ? newHeight : newHeight - 1;
        
        scaleFilter = `scale=${newWidth}:${newHeight}`;
      }

      // Build FFmpeg command
      const command = ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .format('mp4');

      // Add scaling filter if needed
      if (scaleFilter) {
        command.videoFilters(scaleFilter);
      }

      // Build output options for streaming optimization
      const outputOptions = [
        `-preset ${VIDEO_PRESET}`, // Encoding speed vs compression
        '-profile:v high', // H.264 profile for compatibility
        '-level 4.0', // H.264 level
        '-pix_fmt yuv420p', // Pixel format for maximum compatibility
        '-movflags +faststart', // Move metadata to beginning for streaming (enables progressive download)
        '-g 30', // Keyframe interval (30 frames = ~1 second at 30fps)
        '-sc_threshold 0', // Disable scene change detection for consistent keyframes
        '-keyint_min 30', // Minimum keyframe interval
        '-b_strategy 1', // Adaptive B-frame placement
        '-bf 3', // B-frames for better compression
        '-refs 3' // Reference frames
      ];

      // Add compression settings
      if (ENABLE_COMPRESSION) {
        if (VIDEO_BITRATE) {
          // Use bitrate-based encoding
          outputOptions.push(`-b:v ${VIDEO_BITRATE}`);
          outputOptions.push(`-maxrate ${VIDEO_BITRATE}`);
          outputOptions.push(`-bufsize ${parseInt(VIDEO_BITRATE) * 2}k`); // 2x bitrate buffer
        } else {
          // Use CRF (Constant Rate Factor) for quality-based encoding
          outputOptions.push(`-crf ${VIDEO_CRF}`);
        }
      } else {
        // Minimal compression - maintain quality
        outputOptions.push('-crf 18'); // High quality
      }

      // Audio settings
      outputOptions.push(`-b:a ${AUDIO_BITRATE}`);
      outputOptions.push('-ar 48000'); // Sample rate
      outputOptions.push('-ac 2'); // Stereo audio

      // Apply output options
      command.outputOptions(outputOptions);

      // Progress tracking
      command.on('progress', (progress) => {
        if (progressCallback && progress.percent) {
          progressCallback(parseFloat(progress.percent));
        }
      });

      // Completion handlers
      command.on('end', () => {
        resolve();
      });

      command.on('error', (err) => {
        reject(new Error(`Transcoding failed: ${err.message}`));
      });

      // Save output
      command.save(outputPath);
    });
  });
};

/**
 * Generate thumbnail from video
 */
const generateThumbnail = (videoPath, thumbnailPath, progressCallback = null) => {
  return new Promise((resolve, reject) => {
    // Get video duration first
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        return reject(new Error(`Failed to get video metadata: ${err.message}`));
      }

      const duration = metadata.format.duration;
      const thumbnailTime = Math.floor(duration * 0.1); // 10% into video

      ffmpeg(videoPath)
        .screenshots({
          timestamps: [thumbnailTime],
          filename: path.basename(thumbnailPath),
          folder: path.dirname(thumbnailPath),
          size: '1280x720'
        })
        .on('end', () => {
          if (progressCallback) {
            progressCallback(100);
          }
          resolve();
        })
        .on('error', (err) => {
          reject(new Error(`Thumbnail generation failed: ${err.message}`));
        });
    });
  });
};

/**
 * Get video metadata (duration, resolution, etc.)
 */
const getVideoMetadata = (videoPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        return reject(new Error(`Failed to get video metadata: ${err.message}`));
      }

      const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
      const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');

      resolve({
        duration: Math.floor(metadata.format.duration || 0),
        width: videoStream?.width || 0,
        height: videoStream?.height || 0,
        codec: videoStream?.codec_name || 'unknown',
        bitrate: metadata.format.bit_rate || 0,
        hasAudio: !!audioStream
      });
    });
  });
};

/**
 * Trigger video processing (to be called after upload)
 */
const triggerProcessing = async (videoId) => {
  // This will be called asynchronously
  // Processing will be handled by the job queue or directly
  return videoId;
};

module.exports = {
  processVideo,
  transcodeVideo,
  generateThumbnail,
  getVideoMetadata,
  triggerProcessing
};

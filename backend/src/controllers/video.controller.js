const Video = require('../models/Video');
const Organization = require('../models/Organization');
const { tenantQuery } = require('../middlewares/tenant.middleware');
const { getFileInfo } = require('../middlewares/upload.middleware');
const {
  getOriginalFilePath,
  getProcessedFilePath,
  renameToSecurePath,
  getFileExtension,
  ensureTenantDirectory,
  deleteFile
} = require('../utils/fileStorage.utils');
const { addToQueue } = require('../services/processingQueue.service');
const { cleanupUploadedFile, cleanupVideoRecord } = require('../utils/fileCleanup.utils');
const { asyncHandler, AppError, NotFoundError, ValidationError } = require('../middlewares/errorHandler.middleware');

// @desc    Get all videos for the current tenant
// @route   GET /api/videos
// @access  Private
const getAllVideos = async (req, res) => {
  try {
    const { status, search } = req.query;
    const tenantId = req.user.tenantId;

    // Build query with tenant isolation
    const query = tenantQuery(tenantId);
    
    if (status) {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const videos = await Video.find(query)
      .populate('uploadedBy', 'email')
      .populate('organization', 'name tenantId')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: videos.length,
      data: { videos }
    });
  } catch (error) {
    console.error('Get videos error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching videos',
      error: error.message
    });
  }
};

// @desc    Get single video by ID (tenant-scoped)
// @route   GET /api/videos/:id
// @access  Private
const getVideoById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId;

  // Ensure video belongs to the tenant
  const video = await Video.findOne(tenantQuery(tenantId, { _id: id }))
    .populate('uploadedBy', 'email')
    .populate('organization', 'name tenantId');

  if (!video) {
    throw new NotFoundError('Video');
  }

  res.status(200).json({
    success: true,
    data: { video }
  });
});

// @desc    Upload and create new video (tenant-scoped)
// @route   POST /api/videos/upload
// @access  Private (Editor/Admin)
const uploadVideo = asyncHandler(async (req, res) => {
  let tempFilePath = null;
  let videoId = null;
  
  try {
    // Check if file was uploaded
    if (!req.file) {
      throw new ValidationError('No video file provided');
    }

    const tenantId = req.user.tenantId;
    const userId = req.user.userId;
    tempFilePath = req.file.path; // Store for cleanup if needed

    // Get file information
    const fileInfo = getFileInfo(req);
    const fileExtension = getFileExtension(fileInfo.originalname);
    
    // Ensure tenant directory exists
    ensureTenantDirectory(tenantId);
    
    // Get organization
    const organization = await Organization.findOne({ tenantId });

    // Create video record first to get videoId
    const videoData = {
      title: req.body.title || fileInfo.originalname,
      description: req.body.description || '',
      filename: fileInfo.filename,
      originalFilename: fileInfo.originalname,
      fileSize: fileInfo.size,
      mimeType: fileInfo.mimetype,
      status: 'uploaded', // Will be updated to 'processing' when job starts
      tenantId,
      organization: organization?._id,
      uploadedBy: userId,
      // Temporary path - will be updated after rename
      originalFilePath: tempFilePath,
      filePath: tempFilePath // Legacy support
    };

    const video = await Video.create(videoData);
    videoId = video._id.toString();

    // Rename file to secure naming: {videoId}_original.{ext}
    const secureOriginalPath = getOriginalFilePath(tenantId, videoId, fileExtension);
    await renameToSecurePath(tempFilePath, secureOriginalPath);

    // Update video record with secure paths
    video.originalFilePath = secureOriginalPath;
    video.filePath = secureOriginalPath; // Legacy support
    await video.save();

    await video.populate('uploadedBy', 'email');
    await video.populate('organization', 'name tenantId');

    // Trigger processing job asynchronously
    const io = req.app.locals.io;
    if (io) {
      // Add to processing queue
      addToQueue(videoId, io);
    } else {
      console.warn('Socket.io not available, processing will not be triggered');
    }

    res.status(201).json({
      success: true,
      message: 'Video uploaded successfully. Processing started.',
      data: { video }
    });
  } catch (error) {
    // Cleanup on error
    if (tempFilePath) {
      await cleanupUploadedFile(tempFilePath);
    }
    
    if (videoId) {
      await cleanupVideoRecord(videoId);
    }
    
    // Re-throw error to be handled by error handler middleware
    throw error;
  }
});

// @desc    Create new video metadata (without file upload)
// @route   POST /api/videos
// @access  Private (Editor/Admin)
const createVideo = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;

    // Ensure tenantId is set (should be done by middleware, but double-check)
    const videoData = {
      ...req.body,
      tenantId,
      uploadedBy: userId
    };

    const video = await Video.create(videoData);

    await video.populate('uploadedBy', 'email');
    await video.populate('organization', 'name tenantId');

    res.status(201).json({
      success: true,
      message: 'Video created successfully',
      data: { video }
    });
  } catch (error) {
    console.error('Create video error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating video',
      error: error.message
    });
  }
};

// @desc    Update video (tenant-scoped)
// @route   PUT /api/videos/:id
// @access  Private (Editor/Admin)
const updateVideo = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId;

  // Ensure video belongs to the tenant
  const video = await Video.findOne(tenantQuery(tenantId, { _id: id }));

  if (!video) {
    throw new NotFoundError('Video');
  }

  // Prevent tenantId from being changed
  delete req.body.tenantId;
  delete req.body.uploadedBy; // Prevent changing uploader

  const updatedVideo = await Video.findByIdAndUpdate(
    id,
    req.body,
    { new: true, runValidators: true }
  )
    .populate('uploadedBy', 'email')
    .populate('organization', 'name tenantId');

  res.status(200).json({
    success: true,
    message: 'Video updated successfully',
    data: { video: updatedVideo }
  });
});

// @desc    Delete video (tenant-scoped)
// @route   DELETE /api/videos/:id
// @access  Private (Admin)
const deleteVideo = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId;

  // Ensure video belongs to the tenant
  const video = await Video.findOne(tenantQuery(tenantId, { _id: id }));

  if (!video) {
    throw new NotFoundError('Video');
  }

  // Delete associated files (original, processed, thumbnail)
  const { deleteVideoFiles } = require('../utils/fileStorage.utils');
  await deleteVideoFiles(video);

  // Delete video record
  await Video.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: 'Video deleted successfully',
    data: {}
  });
});

module.exports = {
  getAllVideos,
  getVideoById,
  uploadVideo,
  createVideo,
  updateVideo,
  deleteVideo
};

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { MAX_FILE_SIZE, UPLOAD_PATH, ALLOWED_VIDEO_FORMATS } = require('../config/env');

// Ensure upload directory exists
const ensureUploadDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Configure storage with tenant-based directory structure
// Files will be renamed after video record creation to use {videoId}_original.{ext} format
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Get tenantId from authenticated user (should be set by auth middleware)
    const tenantId = req.user?.tenantId || 'default';
    const tenantUploadPath = path.join(UPLOAD_PATH, tenantId);
    
    // Ensure tenant directory exists
    ensureUploadDir(tenantUploadPath);
    
    cb(null, tenantUploadPath);
  },
  filename: (req, file, cb) => {
    // Temporary filename - will be renamed to {videoId}_original.{ext} after video creation
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    const filename = `temp_${name}-${uniqueSuffix}${ext}`;
    
    cb(null, filename);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  // Check if file is a video by MIME type
  if (!file.mimetype.startsWith('video/')) {
    return cb(new Error('Only video files are allowed'), false);
  }

  // Get file extension
  const ext = path.extname(file.originalname).toLowerCase().slice(1);
  
  // Check if extension is in allowed formats
  if (!ALLOWED_VIDEO_FORMATS.includes(ext)) {
    return cb(new Error(`File format not allowed. Allowed formats: ${ALLOWED_VIDEO_FORMATS.join(', ')}`), false);
  }

  // Additional validation note:
  // - MIME type check (startsWith('video/')) is done above
  // - Extension check ensures only allowed formats (mp4, mkv, avi)
  // - Some browsers/systems may report different MIME types for the same format,
  //   so extension validation is the primary check

  cb(null, true);
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE, // 200MB default
    files: 1 // Only allow single file upload
  }
});

// Error handling middleware for multer errors
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Only one file allowed per upload'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field'
      });
    }
    return res.status(400).json({
      success: false,
      message: 'Upload error: ' + err.message
    });
  }
  
  if (err) {
    // Handle custom errors from fileFilter
    if (err.message) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    return res.status(400).json({
      success: false,
      message: 'Upload error: ' + err.message
    });
  }
  
  next();
};

// Single file upload middleware
const uploadSingle = (fieldName = 'video') => {
  return [
    upload.single(fieldName),
    handleUploadError
  ];
};

// Multiple files upload middleware (if needed in future)
const uploadMultiple = (fieldName = 'videos', maxCount = 5) => {
  return [
    upload.array(fieldName, maxCount),
    handleUploadError
  ];
};

// Get file info helper
const getFileInfo = (req) => {
  if (!req.file) {
    return null;
  }

  return {
    filename: req.file.filename,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    path: req.file.path,
    destination: req.file.destination
  };
};

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  handleUploadError,
  getFileInfo,
  ensureUploadDir
};

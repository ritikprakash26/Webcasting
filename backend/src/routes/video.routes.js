const express = require('express');
const router = express.Router();
const {
  getAllVideos,
  getVideoById,
  uploadVideo,
  createVideo,
  updateVideo,
  deleteVideo
} = require('../controllers/video.controller');
const {
  streamVideo,
  getStreamInfo
} = require('../controllers/stream.controller');
const authenticate = require('../middlewares/auth.middleware');
const { checkRole, authorize } = require('../middlewares/role.middleware');
const { ensureTenant, injectTenantId } = require('../middlewares/tenant.middleware');
const { uploadSingle } = require('../middlewares/upload.middleware');

// Streaming routes (HTTP Range Request support) - Must be before /:id route
// Note: These routes handle auth directly (via query params or headers) for video element compatibility
router.get('/stream/:videoId', streamVideo);
router.head('/stream/:videoId', getStreamInfo);

// All other routes require authentication and tenant context
router.use(authenticate);
router.use(ensureTenant);

// Viewer routes (all authenticated users)
router.get('/', getAllVideos);

// Get video by ID
router.get('/:id', getVideoById);

// Editor/Admin routes
router.post('/upload', injectTenantId, checkRole('editor', 'admin'), uploadSingle('video'), uploadVideo);
router.post('/', injectTenantId, checkRole('editor', 'admin'), createVideo);
router.put('/:id', checkRole('editor', 'admin'), updateVideo);

// Admin only routes
router.delete('/:id', checkRole('admin'), deleteVideo);

module.exports = router;

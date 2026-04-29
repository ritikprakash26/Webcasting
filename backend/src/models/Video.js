const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  filename: {
    type: String,
    required: true
  },
  originalFilename: {
    type: String,
    required: true
  },
  // Secure storage paths
  originalFilePath: {
    type: String,
    required: true
  },
  processedFilePath: {
    type: String
  },
  thumbnailPath: {
    type: String
  },
  // Legacy field for backward compatibility
  filePath: {
    type: String
  },
  duration: {
    type: Number // in seconds
  },
  fileSize: {
    type: Number // in bytes
  },
  mimeType: {
    type: String
  },
  status: {
    type: String,
    enum: ['uploaded', 'processing', 'safe', 'flagged', 'ready', 'failed'],
    default: 'uploaded'
  },
  processingProgress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  sensitivityLevel: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'low'
  },
  // Multi-tenant isolation
  tenantId: {
    type: String,
    required: true,
    index: true // Index for better query performance
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization'
  },
  // User who uploaded the video
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
videoSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

// Index for efficient tenant-based queries
videoSchema.index({ tenantId: 1, createdAt: -1 });

module.exports = mongoose.model('Video', videoSchema);

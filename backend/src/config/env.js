require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/pulse-video',
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  JWT_EXPIRE: process.env.JWT_EXPIRE || '7d',
  JWT_REFRESH_EXPIRE: process.env.JWT_REFRESH_EXPIRE || '30d', // Optional: for refresh tokens
  NODE_ENV: process.env.NODE_ENV || 'development',
  // CORS configuration - Default to allow Vercel and local development
  CORS_ORIGIN: process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' 
    ? 'https://pulsevideouploadandstreaming.vercel.app' 
    : 'http://localhost:3000,http://localhost:5173'),
  CORS_CREDENTIALS: process.env.CORS_CREDENTIALS === 'true' || false,
  // Password hashing
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10,
  // Upload configuration
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 200 * 1024 * 1024, // 200MB in bytes
  UPLOAD_PATH: process.env.UPLOAD_PATH || './uploads',
  ALLOWED_VIDEO_FORMATS: ['mp4', 'mkv', 'avi'],
  ALLOWED_MIME_TYPES: ['video/mp4', 'video/x-matroska', 'video/x-msvideo', 'video/quicktime'],
  // Video processing configuration
  ENABLE_COMPRESSION: process.env.ENABLE_COMPRESSION === 'true' || false,
  VIDEO_CRF: parseInt(process.env.VIDEO_CRF) || 23, // Quality: 18-28 (lower = better quality, larger file)
  VIDEO_PRESET: process.env.VIDEO_PRESET || 'medium', // ultrafast, superfast, veryfast, faster, fast, medium, slow, slower, veryslow
  VIDEO_MAX_RESOLUTION: process.env.VIDEO_MAX_RESOLUTION || '1920x1080', // Max resolution for output
  VIDEO_BITRATE: process.env.VIDEO_BITRATE || null, // Optional: set bitrate (e.g., '2500k')
  AUDIO_BITRATE: process.env.AUDIO_BITRATE || '128k' // Audio bitrate
};

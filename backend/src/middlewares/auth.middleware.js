const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const User = require('../models/User');
const { UnauthorizedError } = require('../middlewares/errorHandler.middleware');
const { asyncHandler } = require('../middlewares/errorHandler.middleware');

// @desc    Verify JWT token and protect routes
const authenticate = asyncHandler(async (req, res, next) => {
  let token;

  // Check for token in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query.token) {
    // Allow token in query for video streaming
    token = req.query.token;
  }

  if (!token) {
    throw new UnauthorizedError('Not authorized, no token provided');
  }

  try {
    // Verify token (this will throw if expired or invalid)
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if user still exists
    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new UnauthorizedError('User no longer exists');
    }

    // Verify tenantId from token matches user's current tenantId (in case it changed)
    const tenantId = decoded.tenantId || user.tenantId;
    
    // Attach user info to request (always include tenantId for multi-tenant isolation)
    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      tenantId: tenantId
    };

    next();
  } catch (error) {
    // Handle specific JWT errors
    if (error.name === 'TokenExpiredError') {
      throw new UnauthorizedError('Token has expired. Please login again.');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new UnauthorizedError('Invalid token. Please login again.');
    }
    // Re-throw other errors (like UnauthorizedError)
    throw error;
  }
});

module.exports = authenticate;

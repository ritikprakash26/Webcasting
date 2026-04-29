const User = require('../models/User');
const Organization = require('../models/Organization');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRE } = require('../config/env');
const { asyncHandler, ValidationError, ConflictError, UnauthorizedError, NotFoundError } = require('../middlewares/errorHandler.middleware');

// Generate JWT Token
const generateToken = (userId, role, tenantId) => {
  return jwt.sign(
    { userId, role, tenantId },
    JWT_SECRET,
    { 
      expiresIn: JWT_EXPIRE,
      issuer: 'pulse-video-api',
      audience: 'pulse-video-client'
    }
  );
};

// Generate Refresh Token (optional, for future use)
const generateRefreshToken = (userId, role, tenantId) => {
  const { JWT_REFRESH_EXPIRE } = require('../config/env');
  return jwt.sign(
    { userId, role, tenantId, type: 'refresh' },
    JWT_SECRET,
    { 
      expiresIn: JWT_REFRESH_EXPIRE,
      issuer: 'pulse-video-api',
      audience: 'pulse-video-client'
    }
  );
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const register = asyncHandler(async (req, res) => {
  const { email, password, role = 'viewer', tenantId, organizationName } = req.body;

  // Validate input
  if (!email || !password || !tenantId) {
    throw new ValidationError('Please provide email, password, and tenantId', {
      email: !email ? 'Email is required' : undefined,
      password: !password ? 'Password is required' : undefined,
      tenantId: !tenantId ? 'Tenant ID is required' : undefined
    });
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ConflictError('User already exists with this email');
  }

  // Check if organization exists, if not create it
  let organization = await Organization.findOne({ tenantId });
  if (!organization) {
    if (!organizationName) {
      throw new ValidationError('Organization not found. Please provide organizationName to create it');
    }
    organization = await Organization.create({
      name: organizationName,
      tenantId
    });
  }

  // Create user
  const user = await User.create({
    email,
    password,
    role,
    tenantId,
    organization: organization._id
  });

  // Generate token
  const token = generateToken(user._id.toString(), user.role, user.tenantId);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId
      },
      token
    }
  });
});

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  console.log('Login attempt for:', email);

  // Validate input
  if (!email || !password) {
    console.error('Validation failed - missing email or password');
    return res.status(400).json({
      success: false,
      error: 'Email and password are required',
      details: {
        email: !email ? 'Email is required' : undefined,
        password: !password ? 'Password is required' : undefined
      }
    });
  }

  try {
    // Check for user
    const user = await User.findOne({ email }).select('+password');
    console.log('User found:', user ? 'Yes' : 'No');

    if (!user) {
      console.error('Login failed - user not found:', email);
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    console.log('Password match:', isMatch ? 'Yes' : 'No');

    if (!isMatch) {
      console.error('Login failed - invalid password for user:', email);
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Generate tokens
    const token = generateToken(user._id, user.role, user.tenantId);
    const refreshToken = generateRefreshToken(user._id, user.role, user.tenantId);
    console.log('Tokens generated successfully');

    // Prepare response data
    const responseData = {
      success: true,
      token,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId
      }
    };

    // Set secure cookie with token
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Use secure in production
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    console.log('Sending successful login response');
    return res.status(200).json(responseData);
  } catch (error) {
    console.error('Login error:', error);
    throw error; // This will be caught by the error handler middleware
  }
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId).populate('organization');
  
  if (!user) {
    throw new NotFoundError('User');
  }

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        organization: user.organization
      }
    }
  });
});

module.exports = {
  register,
  login,
  getMe
};

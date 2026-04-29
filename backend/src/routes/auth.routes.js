const express = require('express');
const router = express.Router();
const cors = require('cors');
const { register, login, getMe } = require('../controllers/auth.controller');
const authenticate = require('../middlewares/auth.middleware');

// CORS configuration for auth routes
const corsOptions = {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
  optionsSuccessStatus: 200
};

// Handle OPTIONS for all routes
router.options('/register', cors(corsOptions));
router.options('/login', cors(corsOptions));
router.options('/me', cors(corsOptions));

// Public routes
router.post('/register', cors(corsOptions), register);
router.post('/login', cors(corsOptions), login);

// Protected routes
router.get('/me', cors(corsOptions), authenticate, getMe);

module.exports = router;

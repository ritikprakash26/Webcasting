const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const { PORT, CORS_ORIGIN, CORS_CREDENTIALS, NODE_ENV } = require('./config/env');
const { initializeProgressSocket } = require('./sockets/progress.socket');

// Import routes
const authRoutes = require('./routes/auth.routes');
const videoRoutes = require('./routes/video.routes');
const userRoutes = require('./routes/user.routes');

// Initialize app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Configure CORS origins
const corsOrigins = CORS_ORIGIN === '*' 
  ? '*' 
  : CORS_ORIGIN.split(',').map(origin => origin.trim());

// Initialize Socket.io with CORS configuration
const io = new Server(server, {
  cors: {
    origin: corsOrigins,
    methods: ['GET', 'POST'],
    credentials: CORS_CREDENTIALS
  }
});

// Initialize Socket.io namespaces
initializeProgressSocket(io);

// Make io available to routes via app.locals
app.locals.io = io;

// Connect to database
connectDB();

// Middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const reqAllowedHeaders = req.headers['access-control-request-headers'];

  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
  res.header(
    'Access-Control-Allow-Headers',
    reqAllowedHeaders || 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-auth-token'
  );
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
});
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/users', userRoutes);

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    version: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || 'unknown'
  });
});

// Import error handler
const { errorHandler, notFound } = require('./middlewares/errorHandler.middleware');

app.all("/", (req, res) => {
  res.json({ message: "Pulse backend is running 🚀" });
});


// 404 handler
app.use(notFound);

// Central error handling middleware (must be last)
app.use(errorHandler);

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`Socket.io server initialized`);
});

module.exports = { app, server, io };

const mongoose = require('mongoose');
const { MONGODB_URI } = require('./env');

const connectDB = async () => {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set. Please configure it in your environment.');
  }

  try {
    // Mongoose 9+ no longer requires (or supports) useNewUrlParser / useUnifiedTopology options
    const conn = await mongoose.connect(MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;

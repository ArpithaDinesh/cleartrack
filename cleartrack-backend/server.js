const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cleartrack';

// Database connection state
let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;
  try {
    if (MONGODB_URI.includes('localhost')) {
      console.warn('⚠️ WARNING: MONGODB_URI is using localhost! This will NOT work on Vercel. Please check your Environment Variables.');
    } else {
      console.log('📡 Attempting to connect to MongoDB...');
    }
    await mongoose.connect(MONGODB_URI, { dbName: 'cleartrack' });
    isConnected = true;
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    if (require.main === module) process.exit(1);
    throw err;
  }
};

// Middleware to ensure DB connection
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// Static file serving for uploads - Using /tmp for Vercel compatibility
app.use('/uploads', express.static(path.join('/tmp', 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/clearance', require('./routes/clearance.routes'));
app.use('/api/ocr', require('./routes/ocr.routes'));
app.use('/api/departments', require('./routes/department.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/bus-routes', require('./routes/busRoute.routes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'CLEARTRACK API is running', timestamp: new Date() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// End of middleware/routes

// Start server if run directly
if (require.main === module) {
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 CLEARTRACK API running on http://localhost:${PORT}`);
    });
  });
}

module.exports = app;

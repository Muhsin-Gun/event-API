// index.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const userRoutes = require('./routes/userRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();
app.use(cors());
app.use(express.json());

// simple request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// mount routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/users', userRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);

// 404
app.use((req, res, next) => {
  res.status(404).json({ error: { status: 404, message: 'Not Found' } });
});

// global error handler
app.use((err, req, res, next) => {
  console.error('ERROR HANDLER:', err && err.stack ? err.stack : err);
  res.status(err && err.status ? err.status : 500).json({
    error: { status: err && err.status ? err.status : 500, message: err && err.message ? err.message : 'Server Error' }
  });
});

// Connect to MongoDB and start server
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.DB_NAME || 'eventdb';
const port = process.env.PORT || 4000;

async function start() {
  try {
    console.log('Connecting to MongoDB...', mongoUri, 'dbName=', dbName);
    await mongoose.connect(mongoUri, { dbName, serverSelectionTimeoutMS: 5000 });
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ Mongo connection error:', err && err.message ? err.message : err);
    process.exit(1);
  }

  app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
  });
}

start();

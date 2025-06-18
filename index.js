// server/index.js

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const initializeRolesAndPermissions = require('./config/initializeRolesAndPermissions');

const app = express();

// Enable CORS for all routes with specific origins
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:5503',
    'http://127.0.0.1:5504',
    'https://evnify.netlify.app', // Your deployed Netlify domain
    'https://your-custom-domain.com' // Replace with your custom domain if any
  ],
  credentials: true
}));

// Middleware
app.use(bodyParser.json());

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api', require('./routes/roleRoutes'));
app.use('/api', require('./routes/userRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/events', require('./routes/eventRoutes'));

// Root route
app.get('/', (req, res) => {
  res.send('Event Management System API');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', {
    message: err.message,
    stack: err.stack
  });
  res.status(500).json({ 
    message: 'Server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Connect to MongoDB and initialize
async function initializeServer() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/event_management';
    console.log('Connecting to MongoDB...');
    
    if (!process.env.MONGODB_URI) {
      console.warn('Warning: MONGODB_URI environment variable not set. Using local database.');
    }
    
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected successfully');

    // Initialize roles and permissions
    console.log('Initializing roles and permissions...');
    await initializeRolesAndPermissions();
    console.log('Roles and permissions initialized successfully');

    // Start the server
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Server initialization error:', {
      message: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Start the server
initializeServer();

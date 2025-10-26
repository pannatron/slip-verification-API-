require('dotenv').config();
const express = require('express');
const cors = require('cors');
const slipRoutes = require('./routes/slipRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('public'));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/slip', slipRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'KBank Slip Verification API',
    version: '1.0.0',
    endpoints: {
      verify: 'POST /api/slip/verify - Upload and verify slip image',
      parse: 'POST /api/slip/parse - Parse slip image without validation',
      validateTransactionId: 'POST /api/slip/validate-transaction-id - Validate transaction ID',
      parseTransactionId: 'POST /api/slip/parse-transaction-id - Parse transaction ID',
      health: 'GET /api/slip/health - Health check'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      error: 'File upload error',
      message: err.message
    });
  }
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log('=================================');
  console.log('KBank Slip Verification API');
  console.log('=================================');
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('=================================');
  console.log('\nAvailable endpoints:');
  console.log(`- POST http://localhost:${PORT}/api/slip/verify`);
  console.log(`- POST http://localhost:${PORT}/api/slip/parse`);
  console.log(`- POST http://localhost:${PORT}/api/slip/validate-transaction-id`);
  console.log(`- POST http://localhost:${PORT}/api/slip/parse-transaction-id`);
  console.log(`- GET  http://localhost:${PORT}/api/slip/health`);
  console.log('=================================\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

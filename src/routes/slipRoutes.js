const express = require('express');
const multer = require('multer');
const ocrService = require('../services/ocrService');
const validationService = require('../services/validationService');
const transactionParser = require('../utils/transactionParser');

const router = express.Router();

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG and PNG are allowed.'));
    }
  }
});

/**
 * POST /api/slip/verify
 * Upload and verify a slip image
 */
router.post('/verify', upload.single('slip'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No slip image provided'
      });
    }

    // Parse expected data from request body
    const expectedData = {
      amount: req.body.expectedAmount ? parseFloat(req.body.expectedAmount) : null,
      recipient: req.body.expectedRecipient || null
    };

    // Parse slip using OCR
    console.log('Processing slip image...');
    const slipData = await ocrService.parseSlip(req.file.buffer);

    if (!slipData.success) {
      return res.status(400).json({
        success: false,
        error: 'Failed to parse slip image',
        details: slipData.error
      });
    }

    // Validate slip data
    console.log('Validating slip data...');
    const validationResult = validationService.validateSlip(slipData, expectedData);

    // Generate report
    const report = validationService.generateReport(validationResult);

    res.json({
      success: true,
      validation: validationResult,
      slipData: {
        transactionId: slipData.transactionId,
        amount: slipData.amount,
        dateTime: slipData.dateTime,
        recipient: slipData.recipient,
        ocrConfidence: slipData.ocrConfidence
      },
      report: report
    });

  } catch (error) {
    console.error('Slip verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/slip/parse
 * Parse slip image and extract data (without validation)
 */
router.post('/parse', upload.single('slip'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No slip image provided'
      });
    }

    // Parse slip using OCR
    console.log('Parsing slip image...');
    const slipData = await ocrService.parseSlip(req.file.buffer);

    if (!slipData.success) {
      return res.status(400).json({
        success: false,
        error: 'Failed to parse slip image',
        details: slipData.error
      });
    }

    res.json({
      success: true,
      data: slipData
    });

  } catch (error) {
    console.error('Slip parsing error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/slip/validate-transaction-id
 * Validate a transaction ID (no image upload)
 */
router.post('/validate-transaction-id', (req, res) => {
  try {
    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({
        success: false,
        error: 'Transaction ID is required'
      });
    }

    const result = validationService.quickValidate(transactionId);

    res.json({
      success: true,
      validation: result
    });

  } catch (error) {
    console.error('Transaction ID validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/slip/parse-transaction-id
 * Parse a transaction ID and extract information
 */
router.post('/parse-transaction-id', (req, res) => {
  try {
    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({
        success: false,
        error: 'Transaction ID is required'
      });
    }

    const parsed = transactionParser.parse(transactionId);

    if (!parsed) {
      return res.status(400).json({
        success: false,
        error: 'Invalid transaction ID format'
      });
    }

    res.json({
      success: true,
      data: parsed
    });

  } catch (error) {
    console.error('Transaction ID parsing error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/slip/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;

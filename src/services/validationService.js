const transactionParser = require('../utils/transactionParser');

/**
 * Slip Validation Service
 * Validates slip data by comparing OCR results with transaction ID information
 */
class ValidationService {
  /**
   * Validate a slip completely with fake slip detection
   * @param {object} slipData - Data extracted from slip via OCR
   * @param {object} expectedData - Expected data to validate against (optional)
   * @returns {object} Validation result
   */
  validateSlip(slipData, expectedData = {}) {
    const result = {
      valid: false,
      errors: [],
      warnings: [],
      details: {},
      score: 0,
      maxScore: 0,
      fakeSlipDetection: null
    };

    // Check if slip parsing was successful
    if (!slipData.success) {
      result.errors.push('Failed to parse slip image');
      return result;
    }

    // Validate transaction ID presence
    if (!slipData.transactionId) {
      result.errors.push('Transaction ID not found in slip');
      return result;
    }

    // Enhanced transaction ID validation with detailed feedback
    const validationResult = transactionParser.isValid(slipData.transactionId);
    if (!validationResult.valid) {
      result.errors.push(`Invalid transaction ID: ${validationResult.reason}`);
      return result;
    }

    // Parse transaction ID
    const parsedTransaction = validationResult.parsed;
    result.details.transactionInfo = parsedTransaction;

    // Fake slip detection (NEW FEATURE)
    const fakeDetection = transactionParser.detectFakeSlip(slipData.transactionId);
    result.fakeSlipDetection = fakeDetection;
    result.maxScore += 25;
    
    if (fakeDetection.riskLevel === 'LOW') {
      result.score += 25;
      result.details.authenticity = 'Likely authentic';
    } else if (fakeDetection.riskLevel === 'MEDIUM') {
      result.score += 15;
      result.details.authenticity = 'Review required';
      result.warnings.push(`Suspicious indicators: ${fakeDetection.reasons.join(', ')}`);
    } else {
      result.details.authenticity = 'High risk of fake';
      result.errors.push(`High risk fake slip: ${fakeDetection.reasons.join(', ')}`);
    }

    // Validate time consistency with OCR date/time if available
    let timeValidation;
    if (slipData.dateTime && slipData.dateTime.rawOCR) {
      // Use enhanced OCR date/time verification
      timeValidation = transactionParser.verifyDateTime(
        slipData.transactionId, 
        slipData.dateTime.rawOCR
      );
      result.details.timeValidation = timeValidation;
      result.maxScore += 25;
      
      if (timeValidation.valid) {
        result.score += 25;
      } else {
        if (timeValidation.dateMatch === false) {
          result.errors.push('Date mismatch between transaction ID and OCR');
        }
        if (timeValidation.timeMatch === false) {
          result.errors.push('Time mismatch between transaction ID and OCR');
        }
        result.warnings.push(timeValidation.message);
      }
    } else {
      // Fallback to legacy time validation
      timeValidation = this.validateTime(slipData, parsedTransaction);
      result.details.timeValidation = timeValidation;
      result.maxScore += 25;
      
      if (timeValidation.valid) {
        result.score += 25;
      } else {
        result.errors.push(timeValidation.message);
      }
    }

    // Validate amount presence
    result.maxScore += 20;
    if (slipData.amount && slipData.amount > 0) {
      result.score += 20;
      result.details.amount = slipData.amount;
      
      // If expected amount provided, validate it
      if (expectedData.amount) {
        const amountMatch = this.validateAmount(slipData.amount, expectedData.amount);
        result.details.amountValidation = amountMatch;
        result.maxScore += 15;
        
        if (amountMatch.valid) {
          result.score += 15;
        } else {
          result.errors.push(amountMatch.message);
        }
      }
    } else {
      result.warnings.push('Amount not found or invalid in slip');
    }

    // Validate recipient if provided
    if (expectedData.recipient && slipData.recipient) {
      const recipientMatch = this.validateRecipient(slipData.recipient, expectedData.recipient);
      result.details.recipientValidation = recipientMatch;
      result.maxScore += 10;
      
      if (recipientMatch.valid) {
        result.score += 10;
      } else {
        result.warnings.push(recipientMatch.message);
      }
    }

    // OCR confidence check
    result.maxScore += 15;
    if (slipData.ocrConfidence >= 70) {
      result.score += 15;
      result.details.ocrQuality = 'Good';
    } else if (slipData.ocrConfidence >= 50) {
      result.score += 10;
      result.details.ocrQuality = 'Fair';
      result.warnings.push('OCR confidence is below optimal level');
    } else {
      result.details.ocrQuality = 'Poor';
      result.warnings.push('Low OCR confidence - results may be unreliable');
    }

    // Calculate final validity
    const scorePercentage = (result.score / result.maxScore) * 100;
    result.valid = result.errors.length === 0 && scorePercentage >= 70;
    result.scorePercentage = Math.round(scorePercentage);

    return result;
  }

  /**
   * Validate time consistency between slip and transaction ID
   * @param {object} slipData - Slip data with dateTime
   * @param {object} parsedTransaction - Parsed transaction data
   * @returns {object} Validation result
   */
  validateTime(slipData, parsedTransaction) {
    if (!slipData.dateTime || !slipData.dateTime.time) {
      return {
        valid: false,
        message: 'Time not found in slip'
      };
    }

    const slipTime = slipData.dateTime.time;
    const transactionTime = parsedTransaction.time;

    // Parse times
    const slipParts = slipTime.split(':');
    const transParts = transactionTime.split(':');

    if (slipParts.length < 2 || transParts.length < 2) {
      return {
        valid: false,
        message: 'Invalid time format'
      };
    }

    const slipHour = parseInt(slipParts[0], 10);
    const slipMinute = parseInt(slipParts[1], 10);
    const transHour = parseInt(transParts[0], 10);
    const transMinute = parseInt(transParts[1], 10);

    // Allow 2 minute difference for processing time
    const hourMatch = slipHour === transHour;
    const minuteDiff = Math.abs(slipMinute - transMinute);
    const minuteMatch = minuteDiff <= 2;

    const valid = hourMatch && minuteMatch;

    return {
      valid: valid,
      slipTime: slipTime,
      transactionTime: transactionTime,
      hourMatch: hourMatch,
      minuteDiff: minuteDiff,
      message: valid 
        ? 'Time matches between slip and transaction ID' 
        : `Time mismatch: Slip shows ${slipTime}, transaction ID indicates ${transactionTime}`
    };
  }

  /**
   * Validate amount matches expected amount
   * @param {number} actualAmount - Amount from slip
   * @param {number} expectedAmount - Expected amount
   * @param {number} tolerance - Allowed difference (default 0.01)
   * @returns {object} Validation result
   */
  validateAmount(actualAmount, expectedAmount, tolerance = 0.01) {
    const difference = Math.abs(actualAmount - expectedAmount);
    const valid = difference <= tolerance;

    return {
      valid: valid,
      actualAmount: actualAmount,
      expectedAmount: expectedAmount,
      difference: difference,
      message: valid 
        ? 'Amount matches expected value' 
        : `Amount mismatch: Expected ${expectedAmount} but found ${actualAmount}`
    };
  }

  /**
   * Validate recipient name
   * @param {string} actualRecipient - Recipient from slip
   * @param {string} expectedRecipient - Expected recipient
   * @returns {object} Validation result
   */
  validateRecipient(actualRecipient, expectedRecipient) {
    // Normalize strings for comparison
    const normalize = (str) => str.toLowerCase().replace(/\s+/g, '');
    const actualNorm = normalize(actualRecipient);
    const expectedNorm = normalize(expectedRecipient);

    // Check if expected is contained in actual or vice versa
    const match = actualNorm.includes(expectedNorm) || expectedNorm.includes(actualNorm);

    return {
      valid: match,
      actualRecipient: actualRecipient,
      expectedRecipient: expectedRecipient,
      message: match 
        ? 'Recipient name matches' 
        : `Recipient mismatch: Expected "${expectedRecipient}" but found "${actualRecipient}"`
    };
  }

  /**
   * Validate transaction type
   * @param {string} transactionId - Transaction ID
   * @param {string} expectedType - Expected transaction type code
   * @returns {object} Validation result
   */
  validateTransactionType(transactionId, expectedType) {
    const parsed = transactionParser.parse(transactionId);
    
    if (!parsed) {
      return {
        valid: false,
        message: 'Invalid transaction ID'
      };
    }

    const valid = parsed.type === expectedType;

    return {
      valid: valid,
      actualType: parsed.type,
      actualTypeDescription: parsed.typeDescription,
      expectedType: expectedType,
      message: valid 
        ? `Transaction type matches: ${parsed.typeDescription}` 
        : `Transaction type mismatch: Expected ${expectedType} but found ${parsed.type}`
    };
  }

  /**
   * Quick validation with enhanced feedback
   * @param {string} transactionId - Transaction ID to validate
   * @returns {object} Quick validation result
   */
  quickValidate(transactionId) {
    const validation = transactionParser.isValid(transactionId);
    const fakeDetection = validation.valid ? transactionParser.detectFakeSlip(transactionId) : null;

    return {
      valid: validation.valid,
      transactionId: transactionId,
      reason: validation.reason,
      parsed: validation.parsed || null,
      fakeSlipDetection: fakeDetection,
      recommendation: validation.valid 
        ? (fakeDetection ? fakeDetection.recommendation : 'Accept')
        : 'Reject - Invalid format'
    };
  }

  /**
   * Validate and detect fake slips in one call
   * @param {string} transactionId - Transaction ID to check
   * @returns {object} Comprehensive validation and fake detection result
   */
  validateAndDetectFake(transactionId) {
    const validation = transactionParser.isValid(transactionId);
    
    if (!validation.valid) {
      return {
        valid: false,
        isFake: true,
        riskLevel: 'HIGH',
        reason: validation.reason,
        recommendation: 'Reject - Invalid transaction ID format'
      };
    }

    const fakeDetection = transactionParser.detectFakeSlip(transactionId);
    
    return {
      valid: validation.valid,
      isFake: fakeDetection.isSuspicious,
      riskLevel: fakeDetection.riskLevel,
      reasons: fakeDetection.reasons,
      recommendation: fakeDetection.recommendation,
      parsed: validation.parsed,
      details: {
        prefix: validation.parsed.prefix,
        year: validation.parsed.year,
        time: validation.parsed.time,
        type: validation.parsed.type,
        typeDescription: validation.parsed.typeDescription,
        sequence: validation.parsed.sequence
      }
    };
  }

  /**
   * Generate validation report with fake slip detection
   * @param {object} validationResult - Result from validateSlip
   * @returns {string} Human-readable report
   */
  generateReport(validationResult) {
    let report = '=== KBANK SLIP VALIDATION REPORT ===\n\n';
    
    report += `Status: ${validationResult.valid ? '✓ VALID' : '✗ INVALID'}\n`;
    report += `Score: ${validationResult.score}/${validationResult.maxScore} (${validationResult.scorePercentage}%)\n`;
    
    // Fake slip detection
    if (validationResult.fakeSlipDetection) {
      const fake = validationResult.fakeSlipDetection;
      report += `Risk Level: ${fake.riskLevel}\n`;
      report += `Authenticity: ${validationResult.details.authenticity || 'Unknown'}\n`;
      report += `Recommendation: ${fake.recommendation}\n\n`;
      
      if (fake.reasons.length > 0) {
        report += '--- Suspicious Indicators ---\n';
        fake.reasons.forEach(reason => {
          report += `⚠ ${reason}\n`;
        });
        report += '\n';
      }
    } else {
      report += '\n';
    }

    if (validationResult.details.transactionInfo) {
      const info = validationResult.details.transactionInfo;
      report += '--- Transaction Information ---\n';
      report += `Transaction ID: ${info.raw}\n`;
      report += `Prefix: ${info.prefix} (KBank K PLUS)\n`;
      report += `Type: ${info.typeDescription} (${info.type})\n`;
      report += `Time: ${info.time}\n`;
      report += `Year: ${info.year} BE\n`;
      report += `Sequence: ${info.sequence}\n`;
      report += `Length: ${info.length} characters\n\n`;
    }

    if (validationResult.details.timeValidation) {
      const time = validationResult.details.timeValidation;
      report += '--- Time Validation ---\n';
      report += `Status: ${time.valid ? '✓' : '✗'}\n`;
      report += `${time.message}\n\n`;
    }

    if (validationResult.details.amount) {
      report += '--- Amount ---\n';
      report += `${validationResult.details.amount} บาท\n\n`;
    }

    if (validationResult.details.ocrQuality) {
      report += '--- OCR Quality ---\n';
      report += `${validationResult.details.ocrQuality}\n\n`;
    }

    if (validationResult.errors.length > 0) {
      report += '--- Errors ---\n';
      validationResult.errors.forEach(error => {
        report += `✗ ${error}\n`;
      });
      report += '\n';
    }

    if (validationResult.warnings.length > 0) {
      report += '--- Warnings ---\n';
      validationResult.warnings.forEach(warning => {
        report += `⚠ ${warning}\n`;
      });
      report += '\n';
    }

    return report;
  }
}

module.exports = new ValidationService();

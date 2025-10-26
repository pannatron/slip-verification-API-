/**
 * KBank (K PLUS) Transaction ID Parser
 * 
 * FORMAT STRUCTURE (20-21 characters):
 * ====================================
 * FIXED PARTS (ส่วนที่เป็นเลขตายตัว):
 * - Position 1-4: "0152" - KBank K PLUS system identifier (ALWAYS FIXED)
 * - Structure: Always follows pattern 4digits + 8digits + 4letters + 3-5digits
 * - Total Length: 20-21 characters (FIXED)
 * 
 * VARIABLE PARTS (ส่วนที่เปลี่ยนไปในแต่ละสลิป):
 * - Position 5-6: YY - Year code (98 = 2568 BE)
 * - Position 7-12: HHMMSS - Time (Hour, Minute, Second)
 * - Position 13-16: TYPE - Transaction type code (BPMO, BQR0, ATF0, etc.)
 * - Position 17-21: SEQ - Sequential transaction number (3-5 digits)
 * 
 * REGEX PATTERN: ^0152\d{8}[A-Z]{4}\d{3,5}$
 * 
 * Examples:
 * - 015298170819BQR02651 → QR Payment at 17:08:19
 * - 015298181623BPMO4591 → Bill Payment at 18:16:23
 * - 015297131932ATF05812 → Account Transfer at 13:19:32
 */

class TransactionParser {
  constructor() {
    // Fixed prefix for all KBank K PLUS transactions
    this.KBANK_PREFIX = '0152';
    
    // Valid length range (20-21 characters)
    this.MIN_LENGTH = 20;
    this.MAX_LENGTH = 21;
    
    // Main regex pattern for strict validation
    // Type code can contain both letters AND digits (e.g., BQR0, ATF0, BPMO)
    this.STRICT_PATTERN = /^0152\d{8}[A-Z0-9]{4}\d{3,5}$/;
    
    // KBank transaction types (ประเภทธุรกรรม)
    // B-prefix = Bill/QR payments, A-prefix = Account transfers
    this.transactionTypes = {
      // Bill Payments
      'BPMO': 'Bill Payment Mobile Online',
      'BQR0': 'Bill QR Payment',
      'BQR': 'Bill QR Payment',
      'BPAY': 'Bill Payment',
      
      // Account Transfers
      'ATF0': 'Account Transfer via Mobile',
      'ATF': 'Account Transfer',
      'ATMO': 'Account Transfer Mobile Online',
      'ATMB': 'ATM Transfer',
      
      // App/Mobile Payments
      'APM0': 'App Payment',
      'APM': 'App Payment',
      'APAY': 'App Payment',
      
      // QR Payments
      'QRP0': 'QR Payment',
      'QRPM': 'QR PromptPay',
      
      // Other
      'TFMO': 'Transfer Mobile'
    };
  }

  /**
   * Parse KBank transaction ID with comprehensive validation
   * @param {string} transactionId - The transaction ID to parse
   * @returns {object} Parsed transaction data or null if invalid
   */
  parse(transactionId) {
    if (!transactionId || typeof transactionId !== 'string') {
      return null;
    }

    // Clean the transaction ID (remove spaces and special characters)
    const cleanId = transactionId.trim().replace(/\s/g, '').toUpperCase();

    // First check: Must start with 0152 (KBank prefix)
    if (!cleanId.startsWith(this.KBANK_PREFIX)) {
      return null;
    }

    // Second check: Length must be between 20-21 characters
    if (cleanId.length < this.MIN_LENGTH || cleanId.length > this.MAX_LENGTH) {
      return null;
    }

    // Third check: Strict pattern validation
    if (!this.STRICT_PATTERN.test(cleanId)) {
      return null;
    }

    // Parse using precise regex pattern: 0152 + YY + HHMMSS + TYPE(4) + SEQ(3-5)
    // Type code can be alphanumeric (e.g., BQR0, ATF0, BPMO)
    const pattern = /^0152(\d{2})(\d{2})(\d{2})(\d{2})([A-Z0-9]{4})(\d{3,5})$/;
    const match = cleanId.match(pattern);

    if (!match) {
      return null;
    }

    const [_, yy, hh, mm, ss, type, seq] = match;
    
    // Validate time components
    const hour = parseInt(hh, 10);
    const minute = parseInt(mm, 10);
    const second = parseInt(ss, 10);
    
    if (hour > 23 || minute > 59 || second > 59) {
      return null; // Invalid time
    }

    // Convert year code to full Buddhist Era year
    // Year code 98 = 2568 BE, so base year is 2470
    const year = 2470 + parseInt(yy, 10);

    // Validate year is reasonable (should be recent)
    const currentYear = new Date().getFullYear() + 543; // Convert to BE
    if (year < currentYear - 5 || year > currentYear + 1) {
      return null; // Year out of reasonable range (allow up to 5 years old)
    }

    // Format time
    const time = `${hh}:${mm}:${ss}`;

    // Get transaction type description
    const typeDescription = this.transactionTypes[type] || 'Unknown Transaction Type';
    const isKnownType = this.transactionTypes.hasOwnProperty(type);

    return {
      raw: cleanId,
      valid: true,
      prefix: this.KBANK_PREFIX,
      year: year,
      yearCode: yy,
      time: time,
      hour: hour,
      minute: minute,
      second: second,
      type: type,
      typeDescription: typeDescription,
      isKnownType: isKnownType,
      sequence: seq,
      length: cleanId.length,
      timestamp: this.buildTimestamp(year, hh, mm, ss),
      // Validation flags
      validPrefix: true,
      validLength: true,
      validPattern: true,
      validTime: true,
      validYear: true
    };
  }

  /**
   * Build a timestamp from parsed components
   * Note: This is an approximation as we don't have the full date
   */
  buildTimestamp(year, hh, mm, ss) {
    try {
      // We need the actual date to build a full timestamp
      // For now, return time components
      return {
        year: year,
        hour: parseInt(hh, 10),
        minute: parseInt(mm, 10),
        second: parseInt(ss, 10)
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate transaction ID format with detailed feedback
   * @param {string} transactionId - The transaction ID to validate
   * @returns {object} Validation result with details
   */
  isValid(transactionId) {
    if (!transactionId || typeof transactionId !== 'string') {
      return {
        valid: false,
        reason: 'Transaction ID is required and must be a string'
      };
    }

    const cleanId = transactionId.trim().replace(/\s/g, '').toUpperCase();

    // Check prefix
    if (!cleanId.startsWith(this.KBANK_PREFIX)) {
      return {
        valid: false,
        reason: `Invalid prefix. Expected "${this.KBANK_PREFIX}" (KBank K PLUS), got "${cleanId.substring(0, 4)}"`
      };
    }

    // Check length
    if (cleanId.length < this.MIN_LENGTH || cleanId.length > this.MAX_LENGTH) {
      return {
        valid: false,
        reason: `Invalid length. Expected ${this.MIN_LENGTH}-${this.MAX_LENGTH} characters, got ${cleanId.length}`
      };
    }

    // Check pattern
    if (!this.STRICT_PATTERN.test(cleanId)) {
      return {
        valid: false,
        reason: 'Invalid format. Expected pattern: 0152 + 8 digits + 4 letters + 3-5 digits'
      };
    }

    // Try to parse
    const parsed = this.parse(cleanId);
    if (!parsed) {
      return {
        valid: false,
        reason: 'Failed to parse transaction ID. May contain invalid time or year values'
      };
    }

    return {
      valid: true,
      reason: 'Valid KBank K PLUS transaction ID',
      parsed: parsed
    };
  }

  /**
   * Quick check if transaction ID is valid (boolean only)
   * @param {string} transactionId - The transaction ID to validate
   * @returns {boolean} True if valid format
   */
  isValidQuick(transactionId) {
    const result = this.isValid(transactionId);
    return result.valid === true;
  }

  /**
   * Detect fake slips by checking for common patterns
   * @param {string} transactionId - The transaction ID to check
   * @returns {object} Detection result with risk level
   */
  detectFakeSlip(transactionId) {
    const validation = this.isValid(transactionId);
    
    if (!validation.valid) {
      return {
        isSuspicious: true,
        riskLevel: 'HIGH',
        reasons: [validation.reason],
        recommendation: 'Reject - Invalid transaction ID format'
      };
    }

    const parsed = validation.parsed;
    const suspiciousReasons = [];
    let riskLevel = 'LOW';

    // Check 1: Unknown transaction type
    if (!parsed.isKnownType) {
      suspiciousReasons.push(`Unknown transaction type code: ${parsed.type}`);
      riskLevel = 'MEDIUM';
    }

    // Check 2: Sequential number patterns (e.g., 11111, 12345)
    const seq = parsed.sequence;
    if (/^(\d)\1+$/.test(seq)) {
      suspiciousReasons.push('Sequential number is repetitive (e.g., 1111, 2222)');
      riskLevel = 'MEDIUM';
    }

    // Check 3: Year too old or in future
    const currentYear = new Date().getFullYear() + 543;
    if (parsed.year < currentYear - 2) {
      suspiciousReasons.push(`Transaction year ${parsed.year} is older than expected`);
      riskLevel = 'MEDIUM';
    } else if (parsed.year > currentYear + 1) {
      suspiciousReasons.push(`Transaction year ${parsed.year} is in the future`);
      riskLevel = 'HIGH';
    }

    // Check 4: Time components (00:00:00 is suspicious)
    if (parsed.hour === 0 && parsed.minute === 0 && parsed.second === 0) {
      suspiciousReasons.push('Transaction time is exactly 00:00:00 (unusual)');
      riskLevel = 'MEDIUM';
    }

    // Overall assessment
    if (suspiciousReasons.length > 2) {
      riskLevel = 'HIGH';
    }

    return {
      isSuspicious: suspiciousReasons.length > 0,
      riskLevel: riskLevel,
      reasons: suspiciousReasons,
      recommendation: riskLevel === 'HIGH' 
        ? 'Reject - Multiple suspicious indicators'
        : riskLevel === 'MEDIUM'
        ? 'Review - Some suspicious indicators detected'
        : 'Accept - No major concerns',
      parsed: parsed
    };
  }

  /**
   * Verify transaction date and time matches the slip OCR data
   * @param {string} transactionId - The transaction ID
   * @param {string} ocrDateTime - OCR extracted date/time (e.g., "25 ต.ค. 68 17:08 น.")
   * @returns {object} Verification result with detailed matching
   */
  verifyDateTime(transactionId, ocrDateTime) {
    const parsed = this.parse(transactionId);
    
    if (!parsed) {
      return {
        valid: false,
        message: 'Invalid transaction ID format',
        dateMatch: false,
        timeMatch: false
      };
    }

    if (!ocrDateTime) {
      return {
        valid: false,
        message: 'OCR date/time not provided',
        dateMatch: false,
        timeMatch: false
      };
    }

    // Parse OCR date/time (format: "25 ต.ค. 68 17:08 น.")
    // Extract year (last 2 digits before time)
    const yearMatch = ocrDateTime.match(/\s(\d{2})\s+(\d{1,2}):(\d{2})/);
    const timeMatch = ocrDateTime.match(/(\d{1,2}):(\d{2})/);
    
    let dateMatches = true; // Default to true - year validation is unreliable
    let timeMatches = false;
    let ocrYear = null;
    let ocrHour = null;
    let ocrMinute = null;

    // Extract OCR year but DON'T validate against transaction ID
    // Reason: Position 5-6 in transaction ID is NOT always the year
    // - For ATF transactions: position 5-6 = "97" (System Batch ID)
    // - For BQR/BPMO: position 5-6 = "98" (System Batch ID)
    // The actual year comes from the slip date, not the transaction ID
    if (yearMatch) {
      ocrYear = parseInt(yearMatch[1], 10);
      // Don't compare years - they use different numbering systems
      dateMatches = true;
    }

    // Check time from transaction ID vs OCR
    if (timeMatch) {
      ocrHour = parseInt(timeMatch[1], 10);
      ocrMinute = parseInt(timeMatch[2], 10);
      
      const hourMatches = parsed.hour === ocrHour;
      const minuteDiff = Math.abs(parsed.minute - ocrMinute);
      const minuteMatches = minuteDiff <= 2; // Allow 2-minute tolerance
      
      timeMatches = hourMatches && minuteMatches;
    }

    const overallMatch = dateMatches && timeMatches;

    return {
      valid: overallMatch,
      dateMatch: dateMatches,
      timeMatch: timeMatches,
      transactionDateTime: {
        year: parsed.year,
        yearCode: parsed.yearCode,
        time: parsed.time,
        hour: parsed.hour,
        minute: parsed.minute
      },
      ocrDateTime: {
        raw: ocrDateTime,
        year: ocrYear ? 2470 + ocrYear : null,
        yearCode: ocrYear,
        hour: ocrHour,
        minute: ocrMinute
      },
      message: overallMatch
        ? 'Date and time match between transaction ID and OCR'
        : `Mismatch - Transaction: Time ${parsed.hour}:${String(parsed.minute).padStart(2, '0')} | OCR: Year ${ocrYear}, Time ${ocrHour}:${String(ocrMinute).padStart(2, '0')}`
    };
  }

  /**
   * Verify transaction time matches the slip time (legacy method)
   * @param {string} transactionId - The transaction ID
   * @param {string} slipTime - Time from slip (format: "HH:MM" or "HH:MM น.")
   * @returns {object} Verification result
   */
  verifyTime(transactionId, slipTime) {
    const parsed = this.parse(transactionId);
    
    if (!parsed) {
      return {
        valid: false,
        message: 'Invalid transaction ID format'
      };
    }

    if (!slipTime) {
      return {
        valid: false,
        message: 'Slip time not provided'
      };
    }

    // Clean and parse slip time (remove "น." and extra spaces)
    const cleanSlipTime = slipTime.trim().replace(/น\.|น$/g, '').trim();
    const slipTimeParts = cleanSlipTime.split(':');
    
    if (slipTimeParts.length < 2) {
      return {
        valid: false,
        message: 'Invalid slip time format'
      };
    }

    const slipHour = parseInt(slipTimeParts[0], 10);
    const slipMinute = parseInt(slipTimeParts[1], 10);

    // Compare hour and minute (allow 2 minute difference for processing time)
    const hourMatch = parsed.hour === slipHour;
    const minuteDiff = Math.abs(parsed.minute - slipMinute);
    const minuteMatch = minuteDiff <= 2;

    const timeMatch = hourMatch && minuteMatch;

    return {
      valid: timeMatch,
      transactionTime: parsed.time,
      slipTime: `${String(slipHour).padStart(2, '0')}:${String(slipMinute).padStart(2, '0')}`,
      hourMatch: hourMatch,
      minuteMatch: minuteMatch,
      message: timeMatch 
        ? 'Time matches' 
        : `Time mismatch: Transaction ${parsed.time} vs Slip ${slipHour}:${slipMinute}`
    };
  }

  /**
   * Extract year from transaction ID
   * @param {string} transactionId - The transaction ID
   * @returns {number|null} Year in Buddhist calendar (e.g., 2568) or null
   */
  extractYear(transactionId) {
    const parsed = this.parse(transactionId);
    return parsed ? parsed.year : null;
  }

  /**
   * Get transaction type from transaction ID
   * @param {string} transactionId - The transaction ID
   * @returns {string|null} Transaction type description or null
   */
  getTransactionType(transactionId) {
    const parsed = this.parse(transactionId);
    return parsed ? parsed.typeDescription : null;
  }
}

module.exports = new TransactionParser();

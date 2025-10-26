const Tesseract = require('tesseract.js');
const sharp = require('sharp');

/**
 * OCR Service for extracting text from slip images
 */
class OCRService {
  constructor() {
    this.worker = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the OCR worker
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      this.worker = await Tesseract.createWorker('tha+eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      
      // Configure Tesseract parameters for better alphanumeric recognition
      await this.worker.setParameters({
        tessedit_char_whitelist: '',  // Allow all characters
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,  // Auto page segmentation
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
        // Don't treat everything as numbers - allow letters too
        classify_bln_numeric_mode: '0'
      });
      
      this.isInitialized = true;
      console.log('OCR Worker initialized successfully with enhanced alphanumeric recognition');
    } catch (error) {
      console.error('Failed to initialize OCR worker:', error);
      throw error;
    }
  }

  /**
   * Preprocess image for better OCR accuracy
   * @param {Buffer} imageBuffer - The image buffer
   * @returns {Promise<Buffer>} Preprocessed image buffer
   */
  async preprocessImage(imageBuffer) {
    try {
      // Enhance image for better OCR with optimized settings for alphanumeric text
      const processedImage = await sharp(imageBuffer)
        .resize(2400, 2400, {  // Increased resolution for better character recognition
          fit: 'inside',
          withoutEnlargement: false
        })
        .greyscale()
        .normalize()
        .linear(1.2, -(128 * 0.2))  // Increase contrast
        .sharpen({
          sigma: 1.5,  // Enhanced sharpening for clearer text
        })
        .toBuffer();

      return processedImage;
    } catch (error) {
      console.error('Image preprocessing error:', error);
      // Return original if preprocessing fails
      return imageBuffer;
    }
  }

  /**
   * Extract text from image using OCR
   * @param {Buffer} imageBuffer - The image buffer
   * @returns {Promise<object>} OCR result with text and confidence
   */
  async extractText(imageBuffer) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Preprocess image
      const processedImage = await this.preprocessImage(imageBuffer);

      // Perform OCR
      const result = await this.worker.recognize(processedImage);

      return {
        text: result.data.text,
        confidence: result.data.confidence,
        lines: result.data.lines.map(line => ({
          text: line.text,
          confidence: line.confidence
        }))
      };
    } catch (error) {
      console.error('OCR extraction error:', error);
      throw new Error('Failed to extract text from image');
    }
  }

  /**
   * Clean and normalize OCR text to fix common misreadings
   * @param {string} text - Raw OCR text
   * @returns {string} Cleaned text
   */
  cleanOCRText(text) {
    if (!text) return '';
    
    // Common OCR mistakes mapping (Thai chars misread as English and vice versa)
    const ocrFixes = {
      // Special patterns with separators (must come first for proper replacement)
      '/เว': 'APM',
      '/เอที': 'ATF',
      '/เอ': 'A',
      '/บี': 'B',
      
      // Thai characters that should be English letters (transaction type codes)
      'เวม': 'APM',
      'เว': 'APM',  // APM transaction type
      'เอที': 'ATF', // ATF transaction type
      'บีคิว': 'BQ',  // BQR transaction type
      'บีคิวอาร์': 'BQR',  // BQR full
      'บีพี': 'BP',   // BPMO transaction type
      'ดู': 'QR',  // Common OCR mistake for "QR"
      'ดูอาร์': 'QR',
      
      // Individual Thai letter sounds to English
      'เอ': 'A',
      'บี': 'B',
      'ซี': 'C', 
      'ดี': 'D',
      'อี': 'E',
      'เอฟ': 'F',
      'จี': 'G',
      'เอช': 'H',
      'ไอ': 'I',
      'เจ': 'J',
      'เค': 'K',
      'แอล': 'L',
      'เอ็ม': 'M',
      'เอ็น': 'N',
      'โอ': 'O',
      'พี': 'P',
      'คิว': 'Q',
      'อาร์': 'R',
      'เอส': 'S',
      'ที': 'T',
      'ยู': 'U',
      'วี': 'V',
      'ดับเบิลยู': 'W',
      'เอ็กซ์': 'X',
      'วาย': 'Y',
      'แซด': 'Z',
      
      // Other patterns
      'เเอ': 'A',
      
      // Common symbol mistakes (Thai numerals to Arabic)
      '๐': '0',
      '๑': '1', 
      '๒': '2',
      '๓': '3',
      '๔': '4',
      '๕': '5',
      '๖': '6',
      '๗': '7',
      '๘': '8',
      '๙': '9'
    };
    
    let cleaned = text;
    
    // Apply fixes
    for (const [wrong, correct] of Object.entries(ocrFixes)) {
      cleaned = cleaned.replace(new RegExp(wrong, 'g'), correct);
    }
    
    return cleaned;
  }

  /**
   * Fix common OCR character confusions in transaction IDs
   * @param {string} transactionId - The transaction ID to fix
   * @returns {string} Fixed transaction ID
   */
  fixTransactionIdOCRErrors(transactionId) {
    if (!transactionId || transactionId.length < 20) {
      return transactionId;
    }

    // First, remove any Thai characters that might have been mixed in
    let cleaned = transactionId;
    
    // Replace common Thai OCR mistakes in transaction IDs
    const thaiToEnglish = {
      'ดู': 'QR',     // "ดู" (pronounced "doo") is often mistaken for "QR"
      'คิว': 'Q',      // "คิว" is "Q"
      'อาร์': 'R',     // "อาร์" is "R"
      'บี': 'B',       // "บี" is "B"
      'เอ': 'A',       // "เอ" is "A"
      'ที': 'T',       // "ที" is "T"
      'เอฟ': 'F',      // "เอฟ" is "F"
      'พี': 'P',       // "พี" is "P"
      'เอ็ม': 'M',     // "เอ็ม" is "M"
      'โอ': 'O'        // "โอ" is "O"
    };
    
    // Apply Thai to English replacements
    for (const [thai, eng] of Object.entries(thaiToEnglish)) {
      cleaned = cleaned.replace(new RegExp(thai, 'g'), eng);
    }
    
    // Remove any remaining Thai characters (keep only alphanumeric)
    cleaned = cleaned.replace(/[ก-๙]/g, '');

    // Special case: Handle pattern like "0152981708198QR802651" → "015298170819BQR02651"
    // This is where OCR reads "BQR0" as "8QR8" or "8QR80"
    // Need to handle: 0152(8 digits)(8QR8 or 8QR80)(4-5 digits)
    // The issue is that "8QR802651" gets split into groups incorrectly
    // We need to match: prefix(12 chars) + 8QR8/8QR80 + suffix
    const bqrPattern = cleaned.match(/^(0152\d{8})(8QR[08]0?)(\d{4,5})$/);
    if (bqrPattern) {
      // Remove the extra "0" if present: 8QR80 -> BQR0, 8QR8 -> BQR0
      return bqrPattern[1] + 'BQR0' + bqrPattern[3];
    }

    // Check if ID matches pattern: 0152(8 digits)(some chars)(3-5 digits)
    // Use non-greedy matching to properly split the middle section
    const match = cleaned.match(/^(0152\d{8})(.{2,7}?)(\d{3,5})$/);
    
    if (match) {
      const prefix = match[1];  // 0152 + 8 digits
      let middle = match[2];    // Should be letters but might be numbers
      const suffix = match[3];  // 3-5 digits
      
      // Handle patterns with mixed letters and numbers like "8QR8"
      if (middle.match(/^8QR8$/)) {
        return prefix + 'BQR0' + suffix;
      }
      if (middle.match(/^8QR0$/)) {
        return prefix + 'BQR0' + suffix;
      }
      
      // If middle section is all numbers, it's likely letters misread as numbers
      if (/^\d+$/.test(middle) && middle.length >= 2 && middle.length <= 4) {
        // Common OCR letter-to-number confusions in transaction codes
        const numberToLetter = {
          '0': 'O',
          '1': 'I',  // or T
          '3': 'B',  // or E
          '4': 'A',
          '5': 'S',
          '6': 'F',  // or G
          '7': 'T',
          '8': 'B',  // Often B in BQR
          '2': 'Z'
        };
        
        // Known transaction type codes for KBank (with alphanumeric patterns)
        const knownCodes = ['ATF0', 'ATF', 'APM0', 'APM', 'BQR0', 'BQR', 'BPMO', 'TRF', 'PMT', 'BIL'];
        
        // Try to reconstruct the code
        let reconstructed = '';
        for (let char of middle) {
          reconstructed += numberToLetter[char] || char;
        }
        
        // Special patterns for common transaction types
        // Pattern: 8XX8 -> BQR0 (where XX could be digits representing Q and R)
        if (middle.match(/^8.{2}8$/)) {
          return prefix + 'BQR0' + suffix;
        }
        
        // Pattern: 8008 -> BQR0 (8 = B, 00 = QR misread, 8 = 0)
        if (middle === '8008' || middle === '8080') {
          return prefix + 'BQR0' + suffix;
        }
        
        // Special case: "816" is commonly "ATF"
        if (middle === '816' || middle === '8160') {
          return prefix + 'ATF0' + suffix;
        }
        
        // Pattern: 8XX -> BXX (B-prefixed codes like BQR, BPMO)
        if (middle.startsWith('8') && middle.length >= 3) {
          // Try BQR0 pattern (8 = B, common ending 0)
          if (middle.match(/^8\d{2}0$/)) {
            return prefix + 'BQR0' + suffix;
          }
          // Try ATF pattern
          if (middle === '8TF' || middle === '8T6' || middle === '816') {
            return prefix + 'ATF0' + suffix;
          }
          // Try APM pattern  
          if (middle === '8PM' || middle.match(/^8P\d$/)) {
            return prefix + 'APM0' + suffix;
          }
        }
        
        // Check if reconstructed matches any known code
        const reconstructedUpper = reconstructed.toUpperCase();
        for (const code of knownCodes) {
          if (reconstructedUpper === code || reconstructedUpper.startsWith(code.substring(0, 3))) {
            return prefix + code + suffix;
          }
        }
        
        // If we have 4 characters and last is 0, it's likely a valid code
        if (middle.length === 4 && middle.endsWith('0')) {
          return prefix + reconstructed + suffix;
        }
      }
      
      // If middle has letters and numbers mixed (e.g., "8QR8", "8QR0")
      if (/[A-Z]/.test(middle) && middle.length >= 3 && middle.length <= 4) {
        // Handle specific mixed patterns
        if (middle.match(/^8[A-Z]+8$/)) {
          // Pattern like "8QR8" -> "BQR0"
          middle = 'B' + middle.substring(1, middle.length - 1) + '0';
        } else if (middle.match(/^8[A-Z]+0$/)) {
          // Pattern like "8QR0" -> "BQR0"  
          middle = 'B' + middle.substring(1);
        }
        return prefix + middle + suffix;
      }
    }
    
    return cleaned;
  }

  /**
   * Extract transaction ID from OCR text with enhanced cleaning
   * @param {string} ocrText - The OCR extracted text
   * @returns {string|null} Transaction ID or null if not found
   */
  extractTransactionId(ocrText) {
    if (!ocrText) {
      return null;
    }

    // Clean OCR text first
    const cleanedText = this.cleanOCRText(ocrText);

    // Pattern for KBank transaction ID - more flexible patterns
    const patterns = [
      // Standard pattern with letters - 0152(8 digits)(2-4 letters)(3-5 digits)
      /0152\d{8}[A-Z]{2,4}\d{3,5}/gi,
      // With possible separators like / or space
      /0152\d{8}[\/\s]?[A-Z]{2,4}[\/\s]?\d{3,5}/gi,
      // After label with possible Thai/English mix and separators
      /เลขที่รายการ[:\s]*([0-9A-Z\/\s]+)/gi,
      /reference[:\s]*([0-9A-Z\/\s]+)/gi,
      // More relaxed pattern to catch IDs where letters might be misread as numbers
      /0152\d{8}[A-Z0-9]{3,7}\d{3,5}/gi
    ];

    let bestMatch = null;
    let bestScore = 0;

    for (const pattern of patterns) {
      const matches = Array.from(cleanedText.matchAll(pattern));
      
      for (const match of matches) {
        let transactionId = match[1] || match[0];
        
        // Clean up the extracted ID
        transactionId = transactionId
          .replace(/เลขที่รายการ/g, '')
          .replace(/reference/gi, '')
          .replace(/[:：]/g, '')
          .trim();
        
        // Apply OCR fixes again on the extracted ID
        transactionId = this.cleanOCRText(transactionId);
        
        // Remove any remaining non-alphanumeric (including slashes, spaces, special chars)
        transactionId = transactionId.replace(/[^0-9A-Z]/gi, '').toUpperCase();
        
        // Check if it looks like a valid transaction ID
        if (transactionId.startsWith('0152')) {
          const length = transactionId.length;
          
          // Score based on length (20-21 is perfect)
          let score = 0;
          if (length >= 20 && length <= 21) {
            score = 100;
          } else if (length >= 18 && length <= 23) {
            score = 50 + (20 - Math.abs(20 - length)) * 5;
          }
          
          if (score > bestScore) {
            bestScore = score;
            bestMatch = transactionId;
          }
        }
      }
    }

    // Also try direct extraction from original text with multiple patterns
    if (!bestMatch) {
      const directPatterns = [
        /0152\d{8}[A-Z]{2,4}\d{3,5}/i,
        /0152\d{8}[\/\s]?[A-Z]{2,4}[\/\s]?\d{3,5}/i,
        /0152\d{8}[A-Z0-9]{3,7}\d{3,5}/i
      ];
      
      for (const pattern of directPatterns) {
        const directMatch = ocrText.match(pattern);
        if (directMatch) {
          let cleaned = directMatch[0].toUpperCase();
          cleaned = this.cleanOCRText(cleaned);
          cleaned = cleaned.replace(/[^0-9A-Z]/gi, '');
          
          // Check if it has the expected structure: 0152(8 digits)(letters)(digits)
          // Expected format: 015297131932ATF05812 (20-21 chars)
          if (cleaned.length >= 19 && cleaned.length <= 22 && cleaned.startsWith('0152')) {
            // Verify it has letters in the middle (not all numbers)
            const hasLetters = /0152\d{8}[A-Z]{2,4}\d{3,5}/.test(cleaned);
            if (hasLetters || cleaned.length === 20 || cleaned.length === 21) {
              bestMatch = cleaned;
              break;
            }
          }
        }
      }
    }
    
    // If still no match, try to reconstruct from segments
    if (!bestMatch) {
      // Look for pattern like: 015297131932 followed by ATF or similar, then digits
      const segmentMatch = cleanedText.match(/0152\d{8}[\/\s]*([A-Z]{2,4})[\/\s]*\d{3,5}/i);
      if (segmentMatch) {
        let reconstructed = segmentMatch[0].replace(/[^0-9A-Z]/gi, '').toUpperCase();
        if (reconstructed.length >= 19 && reconstructed.length <= 22) {
          bestMatch = reconstructed;
        }
      }
    }
    
    // Try to find any transaction-like number even if all digits
    if (!bestMatch) {
      const allDigitsMatch = cleanedText.match(/0152\d{12,18}/);
      if (allDigitsMatch) {
        bestMatch = allDigitsMatch[0];
      }
    }

    // Apply OCR error correction to fix letter-to-number confusions
    if (bestMatch) {
      bestMatch = this.fixTransactionIdOCRErrors(bestMatch);
    }

    return bestMatch;
  }

  /**
   * Extract amount from OCR text
   * @param {string} ocrText - The OCR extracted text
   * @returns {number|null} Amount or null if not found
   */
  extractAmount(ocrText) {
    if (!ocrText) {
      return null;
    }

    // Pattern for amount - multiple patterns to catch various formats including with newlines
    const patterns = [
      // With "จำนวน" label - handles newlines and spaces between label and amount
      /จำนวน[:\s]*\n*\s*([\d,]+\.?\d*)\s*บาท/gi,
      // Amount with "บาท" - handles comma-separated numbers
      /([\d,]+\.\d{2})\s*บาท/g,
      // Amount followed by space and "บาท"
      /(\d{1,3}(?:,\d{3})*\.\d{2})\s+บาท/g,
      // "บาท" before amount (reversed order)
      /บาท\s*[\n\s]*([\d,]+\.\d{2})/gi,
      // Newline before amount with "บาท"
      /\n\s*([\d,]+\.\d{2})\s*บาท/g,
      // Just numbers with comma separators and decimals
      /([1-9]\d{0,2}(?:,\d{3})*\.\d{2})/g
    ];

    const foundAmounts = [];

    // Try each pattern
    for (const pattern of patterns) {
      const matches = Array.from(ocrText.matchAll(pattern));
      for (const match of matches) {
        if (match[1]) {
          // Remove commas and parse
          const cleanAmount = match[1].replace(/,/g, '');
          const amount = parseFloat(cleanAmount);
          if (!isNaN(amount) && amount > 0 && amount < 10000000) {
            foundAmounts.push({
              value: amount,
              raw: match[1],
              context: match[0]
            });
          }
        }
      }
    }

    // If we found amounts, return the most likely one
    if (foundAmounts.length > 0) {
      // Sort by value descending (larger amounts are more likely to be the transaction amount)
      foundAmounts.sort((a, b) => b.value - a.value);
      
      // Return the largest reasonable amount
      // If there are multiple amounts, prefer ones that appear in proper context
      for (const amt of foundAmounts) {
        // Prefer amounts with proper formatting (with commas for thousands)
        if (amt.raw.includes(',') || amt.value >= 1000) {
          return amt.value;
        }
      }
      
      // Otherwise return the first (largest) amount found
      return foundAmounts[0].value;
    }

    // Fallback: Try to find any decimal number that looks like money (XX.XX format)
    const decimalPattern = /(\d+\.\d{2})/g;
    const decimalMatches = Array.from(ocrText.matchAll(decimalPattern));
    const amounts = [];
    
    for (const match of decimalMatches) {
      const amount = parseFloat(match[1]);
      if (!isNaN(amount) && amount > 0 && amount < 1000000) {
        amounts.push(amount);
      }
    }

    // Return the largest amount found
    if (amounts.length > 0) {
      return Math.max(...amounts);
    }

    return null;
  }

  /**
   * Extract date and time from OCR text with raw OCR text
   * @param {string} ocrText - The OCR extracted text
   * @param {array} lines - OCR lines with confidence
   * @returns {object|null} Date and time info with raw OCR text or null
   */
  extractDateTime(ocrText, lines = []) {
    if (!ocrText) {
      return null;
    }

    // Pattern for Thai date/time: 25 ต.ค. 68 17:08 น.
    const datePattern = /(\d{1,2})\s*(?:ต\.ค\.|พ\.ย\.|ธ\.ค\.|ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.)\s*(\d{2})\s*(\d{1,2}):(\d{2})/i;
    const match = ocrText.match(datePattern);

    let rawOCR = null;
    let confidence = 0;

    // Find the line containing date/time for raw OCR text
    if (lines && lines.length > 0) {
      for (const line of lines) {
        if (line.text && /\d{1,2}:\d{2}/.test(line.text)) {
          rawOCR = line.text.trim();
          confidence = line.confidence;
          break;
        }
      }
    }

    if (match) {
      const day = parseInt(match[1], 10);
      const yearCode = parseInt(match[2], 10);
      const year = 2500 + yearCode;
      const hour = match[3].padStart(2, '0');
      const minute = match[4].padStart(2, '0');
      const time = `${hour}:${minute}`;

      return {
        day: day,
        year: year,
        yearCode: yearCode,
        time: time,
        rawOCR: rawOCR || match[0],
        ocrConfidence: confidence,
        date: match[0] // Full date string for reference
      };
    }

    // Try simpler time pattern
    const timePattern = /(\d{1,2}):(\d{2})\s*น\./;
    const timeMatch = ocrText.match(timePattern);
    
    if (timeMatch) {
      const hour = timeMatch[1].padStart(2, '0');
      const minute = timeMatch[2].padStart(2, '0');
      return {
        time: `${hour}:${minute}`,
        rawOCR: rawOCR || timeMatch[0],
        ocrConfidence: confidence
      };
    }

    return null;
  }

  /**
   * Extract sender and receiver information from OCR text
   * @param {string} ocrText - The OCR extracted text
   * @param {array} lines - OCR lines with confidence
   * @returns {object} Sender and receiver information
   */
  extractParties(ocrText, lines = []) {
    if (!ocrText) {
      return {
        sender: null,
        receiver: null
      };
    }

    let sender = null;
    let receiver = null;
    const foundNames = [];

    // Look for company/person name patterns with their labels
    const senderPatterns = [
      /จาก[:\s]*([^\n]+)/i,
      /ผู้โอน[:\s]*([^\n]+)/i,
      /from[:\s]*([^\n]+)/i
    ];

    const receiverPatterns = [
      /ถึง[:\s]*([^\n]+)/i,
      /ผู้รับ[:\s]*([^\n]+)/i,
      /to[:\s]*([^\n]+)/i,
      /บริษัท[:\s]*([^\n]+)/i,
      /บจก\.[:\s]*([^\n]+)/i,
      /ห้างหุ้นส่วน[:\s]*([^\n]+)/i
    ];

    // Extract sender
    for (const pattern of senderPatterns) {
      const match = ocrText.match(pattern);
      if (match && match[1]) {
        sender = match[1].trim();
        break;
      }
    }

    // Extract receiver
    for (const pattern of receiverPatterns) {
      const match = ocrText.match(pattern);
      if (match && match[1]) {
        receiver = match[1].trim();
        break;
      }
    }

    // If no explicit labels found, look for business names and person names
    if (!sender && !receiver) {
      // Look for business entities (บริษัท, บจก., ห้าง)
      const businessPatterns = [
        /(?:บริษัท|บจก\.|ห้าง)\s*([^\n]+)/gi
      ];

      for (const pattern of businessPatterns) {
        const matches = Array.from(ocrText.matchAll(pattern));
        for (const match of matches) {
          if (match[1]) {
            foundNames.push({
              type: 'business',
              name: match[1].trim()
            });
          }
        }
      }

      // Look for person names (นาย, นาง, นางสาว)
      const personPatterns = [
        /(?:นาย|นาง|นางสาว)\s*([^\n]+)/gi
      ];

      for (const pattern of personPatterns) {
        const matches = Array.from(ocrText.matchAll(pattern));
        for (const match of matches) {
          if (match[1]) {
            foundNames.push({
              type: 'person',
              name: match[1].trim()
            });
          }
        }
      }

      // Assign found names based on transaction flow
      // Typically in a transfer: first name = sender, second = receiver
      if (foundNames.length >= 2) {
        sender = foundNames[0].name;
        receiver = foundNames[1].name;
      } else if (foundNames.length === 1) {
        // If only one name, it's likely the receiver (merchant/payee)
        receiver = foundNames[0].name;
      }
    }

    return {
      sender: sender,
      receiver: receiver,
      confidence: foundNames.length > 0 ? 'medium' : 'low'
    };
  }

  /**
   * Extract recipient name from OCR text (legacy method)
   * @param {string} ocrText - The OCR extracted text
   * @returns {string|null} Recipient name or null
   */
  extractRecipient(ocrText) {
    const parties = this.extractParties(ocrText);
    return parties.receiver || parties.sender;
  }

  /**
   * Parse slip image and extract all information
   * @param {Buffer} imageBuffer - The image buffer
   * @returns {Promise<object>} Parsed slip data
   */
  async parseSlip(imageBuffer) {
    try {
      // Extract text using OCR
      const ocrResult = await this.extractText(imageBuffer);
      const text = ocrResult.text;
      const lines = ocrResult.lines;

      // Extract all information
      const transactionId = this.extractTransactionId(text);
      const amount = this.extractAmount(text);
      const dateTime = this.extractDateTime(text, lines);
      const parties = this.extractParties(text, lines);

      return {
        success: true,
        ocrConfidence: ocrResult.confidence,
        transactionId: transactionId,
        amount: amount,
        dateTime: dateTime,
        sender: parties.sender,
        receiver: parties.receiver,
        recipient: parties.receiver || parties.sender, // Legacy field
        rawText: text,
        lines: ocrResult.lines
      };
    } catch (error) {
      console.error('Slip parsing error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Terminate the OCR worker
   */
  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.isInitialized = false;
      console.log('OCR Worker terminated');
    }
  }
}

module.exports = new OCRService();

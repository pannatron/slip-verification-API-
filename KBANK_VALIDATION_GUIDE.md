# KBank (K PLUS) Slip Validation Guide

## Overview
This document provides comprehensive information about the KBank slip validation system with fake slip detection capabilities.

## Transaction ID Format

### Structure (20-21 characters)
```
0152 YY HH MM SS TYPE SSSS
```

### Components

#### Fixed Parts (ส่วนที่เป็นเลขตายตัว)
| Position | Content | Description | Fixed? |
|----------|---------|-------------|--------|
| 1-4 | `0152` | KBank K PLUS system identifier | ✅ Always fixed |
| - | 20-21 chars | Total length | ✅ Always fixed |
| - | Pattern | 4 digits + 8 digits + 4 alphanumeric + 3-5 digits | ✅ Always fixed |

#### Variable Parts (ส่วนที่เปลี่ยนไปในแต่ละสลิป)
| Position | Example | Description | Changes Based On |
|----------|---------|-------------|------------------|
| 5-6 | `98` | Year code (98 = 2568 BE) | 🕒 Transaction year |
| 7-8 | `17` | Hour (24-hour format) | 🕒 Transaction time |
| 9-10 | `08` | Minute | 🕒 Transaction time |
| 11-12 | `19` | Second | 🕒 Transaction time |
| 13-16 | `BQR0` | Transaction type code | 💳 Transaction channel |
| 17-21 | `2651` | Sequential number | 🔢 System sequence |

### Examples
```
015298170819BQR02651  → QR Payment at 17:08:19 on year 2568
015298181623BPMO4591  → Bill Payment at 18:16:23 on year 2568
015297131932ATF05812  → Account Transfer at 13:19:32 on year 2567
```

### Regex Pattern
```regex
^0152\d{8}[A-Z0-9]{4}\d{3,5}$
```

## Transaction Types

### Bill Payments (B-prefix)
- `BPMO` - Bill Payment Mobile Online
- `BQR0` - Bill QR Payment
- `BQR` - Bill QR Payment
- `BPAY` - Bill Payment

### Account Transfers (A-prefix)
- `ATF0` - Account Transfer via Mobile
- `ATF` - Account Transfer
- `ATMO` - Account Transfer Mobile Online
- `ATMB` - ATM Transfer

### App/Mobile Payments
- `APM0` - App Payment
- `APM` - App Payment
- `APAY` - App Payment

### QR Payments
- `QRP0` - QR Payment
- `QRPM` - QR PromptPay

## Validation Features

### 1. Format Validation
Checks if the transaction ID follows the correct structure:
- ✅ Correct prefix (0152)
- ✅ Correct length (20-21 characters)
- ✅ Valid pattern (digits, letters, structure)
- ✅ Valid time components (hour ≤ 23, minute ≤ 59, second ≤ 59)
- ✅ Reasonable year (within 5 years)

### 2. Fake Slip Detection
Analyzes transaction IDs for suspicious patterns:

#### Risk Levels
- **LOW** - No suspicious indicators, likely authentic
- **MEDIUM** - Some suspicious indicators, requires review
- **HIGH** - Multiple red flags, likely fake

#### Detection Criteria
1. **Unknown Transaction Type** - Type code not in known list (MEDIUM)
2. **Repetitive Sequence** - Pattern like 1111, 2222 (MEDIUM)
3. **Old Transaction Year** - More than 2 years old (MEDIUM)
4. **Future Year** - Year in the future (HIGH)
5. **Suspicious Time** - Exactly 00:00:00 (MEDIUM)

### 3. OCR Date/Time Verification
Compares transaction ID timestamp with OCR-extracted date/time:
- ✅ Year code matching (e.g., "68" in OCR matches "98" in transaction ID)
- ✅ Time matching with 2-minute tolerance
- ✅ Detailed mismatch reporting

### 4. Sender/Receiver Extraction
Automatically identifies parties in the transaction:
- Extracts sender information (ผู้โอน, จาก)
- Extracts receiver information (ผู้รับ, ถึง, บริษัท)
- Handles business entities (บริษัท, บจก., ห้าง)
- Handles person names (นาย, นาง, นางสาว)

## API Usage

### Basic Validation
```javascript
const validationService = require('./src/services/validationService');

// Quick validation
const result = validationService.quickValidate('015298170819BQR02651');
console.log(result.valid); // true
console.log(result.recommendation); // "Accept - No major concerns"
```

### Fake Slip Detection
```javascript
const result = validationService.validateAndDetectFake('015298170819BQR01111');
console.log(result.isFake); // true
console.log(result.riskLevel); // "MEDIUM"
console.log(result.reasons); // ["Sequential number is repetitive (e.g., 1111, 2222)"]
```

### Complete Slip Validation
```javascript
const slipData = {
  success: true,
  transactionId: '015298170819BQR02651',
  amount: 1500.00,
  dateTime: {
    date: '26/10/2568',
    time: '17:08',
    rawOCR: '25 ต.ค. 68 17:08 น.'
  },
  sender: 'นายสมชาย ใจดี',
  receiver: 'บจก. เพย์ โซลูชัน',
  ocrConfidence: 85
};

const result = validationService.validateSlip(slipData, {
  amount: 1500.00,
  recipient: 'บจก. เพย์ โซลูชัน'
});

console.log(result.valid); // true
console.log(result.scorePercentage); // 100
console.log(result.fakeSlipDetection.riskLevel); // "LOW"
```

### Generate Report
```javascript
const report = validationService.generateReport(result);
console.log(report);
```

Output:
```
=== KBANK SLIP VALIDATION REPORT ===

Status: ✓ VALID
Score: 110/110 (100%)
Risk Level: LOW
Authenticity: Likely authentic
Recommendation: Accept - No major concerns

--- Transaction Information ---
Transaction ID: 015298170819BQR02651
Prefix: 0152 (KBank K PLUS)
Type: Bill QR Payment (BQR0)
Time: 17:08:19
Year: 2568 BE
Sequence: 2651
Length: 20 characters

--- Time Validation ---
Status: ✓
Time matches between slip and transaction ID

--- Amount ---
1500 บาท

--- OCR Quality ---
Good
```

## Transaction Parser API

### Parse Transaction ID
```javascript
const transactionParser = require('./src/utils/transactionParser');

const parsed = transactionParser.parse('015298170819BQR02651');
console.log(parsed);
```

Output:
```javascript
{
  raw: '015298170819BQR02651',
  valid: true,
  prefix: '0152',
  year: 2568,
  yearCode: '98',
  time: '17:08:19',
  hour: 17,
  minute: 8,
  second: 19,
  type: 'BQR0',
  typeDescription: 'Bill QR Payment',
  isKnownType: true,
  sequence: '2651',
  length: 20
}
```

### Validate Transaction ID
```javascript
const validation = transactionParser.isValid('015298170819BQR02651');
console.log(validation);
```

Output:
```javascript
{
  valid: true,
  reason: 'Valid KBank K PLUS transaction ID',
  parsed: { /* parsed data */ }
}
```

### Detect Fake Slip
```javascript
const detection = transactionParser.detectFakeSlip('015298170819BQR01111');
console.log(detection);
```

Output:
```javascript
{
  isSuspicious: true,
  riskLevel: 'MEDIUM',
  reasons: ['Sequential number is repetitive (e.g., 1111, 2222)'],
  recommendation: 'Review - Some suspicious indicators detected',
  parsed: { /* parsed data */ }
}
```

### Verify OCR Date/Time
```javascript
const verification = transactionParser.verifyDateTime(
  '015298170819BQR02651',
  '25 ต.ค. 68 17:08 น.'
);
console.log(verification);
```

Output:
```javascript
{
  valid: true,
  dateMatch: true,
  timeMatch: true,
  transactionDateTime: {
    year: 2568,
    yearCode: '98',
    time: '17:08:19',
    hour: 17,
    minute: 8
  },
  ocrDateTime: {
    raw: '25 ต.ค. 68 17:08 น.',
    year: 2568,
    yearCode: 68,
    hour: 17,
    minute: 8
  },
  message: 'Date and time match between transaction ID and OCR'
}
```

## Best Practices

### 1. Always Verify OCR Date/Time
```javascript
// Include raw OCR text in slip data for accurate verification
const slipData = {
  // ...
  dateTime: {
    time: '17:08',
    rawOCR: '25 ต.ค. 68 17:08 น.' // Include this!
  }
};
```

### 2. Check Fake Slip Detection
```javascript
if (result.fakeSlipDetection.riskLevel === 'HIGH') {
  // Reject the transaction
  return { status: 'rejected', reason: result.fakeSlipDetection.recommendation };
} else if (result.fakeSlipDetection.riskLevel === 'MEDIUM') {
  // Flag for manual review
  return { status: 'review', reason: result.fakeSlipDetection.reasons };
}
```

### 3. Use Comprehensive Validation
```javascript
// Don't just check format - use full validation
const result = validationService.validateSlip(slipData, expectedData);

if (!result.valid) {
  console.error('Validation failed:', result.errors);
  return false;
}

if (result.scorePercentage < 70) {
  console.warn('Low confidence score:', result.scorePercentage);
  // Consider manual review
}
```

## Error Handling

### Common Errors

1. **Invalid Transaction ID**
```javascript
{
  valid: false,
  reason: 'Invalid prefix. Expected "0152" (KBank K PLUS), got "0153"'
}
```

2. **Invalid Length**
```javascript
{
  valid: false,
  reason: 'Invalid length. Expected 20-21 characters, got 17'
}
```

3. **Invalid Time Components**
```javascript
{
  valid: false,
  reason: 'Failed to parse transaction ID. May contain invalid time or year values'
}
```

## Year Conversion Formula

### Buddhist Era (BE) to Year Code
```
Year Code = (Buddhist Year - 2470)

Example:
2568 BE → 98 (2568 - 2470 = 98)
2567 BE → 97 (2567 - 2470 = 97)
```

### Year Code to Buddhist Era
```
Buddhist Year = Year Code + 2470

Example:
98 → 2568 BE (98 + 2470 = 2568)
97 → 2567 BE (97 + 2470 = 2567)
```

## Security Considerations

1. **Always validate on server-side** - Never trust client-side validation alone
2. **Log suspicious transactions** - Keep records of flagged slips for analysis
3. **Implement rate limiting** - Prevent automated fake slip generation attempts
4. **Regular pattern updates** - Update detection patterns based on new fake slip trends
5. **Manual review process** - Have human verification for MEDIUM risk transactions

## Testing

Run the test suite:
```bash
node test-validation.js
```

Expected output: All tests should pass with detailed validation results.

## Support

For issues or questions about KBank slip validation:
- Check this guide for common patterns
- Review the test cases in `test-validation.js`
- Examine the source code in `src/utils/transactionParser.js`

## Version History

- **v1.0** - Initial release with basic validation
- **v2.0** - Added fake slip detection
- **v2.1** - Added OCR date/time verification
- **v2.2** - Added sender/receiver extraction
- **v2.3** - Fixed year conversion (2470 base year)

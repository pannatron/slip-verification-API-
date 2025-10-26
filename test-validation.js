/**
 * Test script for K-Bank slip validation with fake detection
 */

const transactionParser = require('./src/utils/transactionParser');
const validationService = require('./src/services/validationService');

console.log('=== KBANK SLIP VALIDATION TEST ===\n');

// Test cases
const testCases = [
  {
    name: 'Valid QR Payment',
    transactionId: '015298170819BQR02651',
    expectedResult: 'VALID'
  },
  {
    name: 'Valid Bill Payment',
    transactionId: '015298181623BPMO4591',
    expectedResult: 'VALID'
  },
  {
    name: 'Valid Account Transfer',
    transactionId: '015297131932ATF05812',
    expectedResult: 'VALID'
  },
  {
    name: 'Invalid Prefix',
    transactionId: '015398170819BQR02651',
    expectedResult: 'INVALID'
  },
  {
    name: 'Invalid Length (too short)',
    transactionId: '01529817081902651',
    expectedResult: 'INVALID'
  },
  {
    name: 'Invalid Pattern (wrong structure)',
    transactionId: '0152ABCD1234EFGH5678',
    expectedResult: 'INVALID'
  },
  {
    name: 'Repetitive Sequence (suspicious)',
    transactionId: '015298170819BQR01111',
    expectedResult: 'SUSPICIOUS'
  },
  {
    name: 'Time 00:00:00 (suspicious)',
    transactionId: '015298000000BQR02651',
    expectedResult: 'SUSPICIOUS'
  },
  {
    name: 'Unknown Transaction Type',
    transactionId: '015298170819XXXX2651',
    expectedResult: 'SUSPICIOUS'
  }
];

console.log('Running tests...\n');

testCases.forEach((testCase, index) => {
  console.log(`\n--- Test ${index + 1}: ${testCase.name} ---`);
  console.log(`Transaction ID: ${testCase.transactionId}`);
  
  // Test 1: Basic validation
  const validation = transactionParser.isValid(testCase.transactionId);
  console.log(`\nBasic Validation:`);
  console.log(`  Valid: ${validation.valid}`);
  console.log(`  Reason: ${validation.reason}`);
  
  if (validation.valid && validation.parsed) {
    const parsed = validation.parsed;
    console.log(`\nParsed Information:`);
    console.log(`  Prefix: ${parsed.prefix}`);
    console.log(`  Year: ${parsed.year} BE`);
    console.log(`  Time: ${parsed.time}`);
    console.log(`  Type: ${parsed.type} (${parsed.typeDescription})`);
    console.log(`  Sequence: ${parsed.sequence}`);
    console.log(`  Length: ${parsed.length} characters`);
  }
  
  // Test 2: Fake slip detection
  if (validation.valid) {
    const fakeDetection = transactionParser.detectFakeSlip(testCase.transactionId);
    console.log(`\nFake Slip Detection:`);
    console.log(`  Risk Level: ${fakeDetection.riskLevel}`);
    console.log(`  Suspicious: ${fakeDetection.isSuspicious}`);
    console.log(`  Recommendation: ${fakeDetection.recommendation}`);
    
    if (fakeDetection.reasons.length > 0) {
      console.log(`  Reasons:`);
      fakeDetection.reasons.forEach(reason => {
        console.log(`    - ${reason}`);
      });
    }
  }
  
  // Test 3: Quick validate
  const quickResult = validationService.quickValidate(testCase.transactionId);
  console.log(`\nQuick Validation:`);
  console.log(`  Valid: ${quickResult.valid}`);
  console.log(`  Recommendation: ${quickResult.recommendation}`);
  
  console.log(`\n${'='.repeat(60)}`);
});

// Test comprehensive validation with mock slip data
console.log('\n\n=== COMPREHENSIVE SLIP VALIDATION TEST ===\n');

const mockSlipData = {
  success: true,
  transactionId: '015298170819BQR02651',
  amount: 1500.00,
  dateTime: {
    date: '26/10/2568',
    time: '17:08'
  },
  recipient: 'ร้านค้า ABC',
  ocrConfidence: 85
};

console.log('Mock Slip Data:');
console.log(JSON.stringify(mockSlipData, null, 2));

const comprehensiveResult = validationService.validateSlip(mockSlipData, {
  amount: 1500.00,
  recipient: 'ร้านค้า ABC'
});

console.log('\n' + validationService.generateReport(comprehensiveResult));

console.log('\n=== TEST COMPLETED ===');

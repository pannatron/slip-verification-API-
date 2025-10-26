/**
 * Test OCR cleaning and transaction ID extraction
 */

const ocrService = require('./src/services/ocrService');

console.log('=== OCR CLEANING TEST ===\n');

// Test case from user feedback
const problematicOCR = `จายบลสาเรจ
25 ต.ค. 68 17:50 น.                          I<+
นาย ปัณณธร บ
6  ธ.กสิกรไทย
gr  XXX-X-x8700-x              =  "
๒            2 ไอ               EN   @   /
RN ไดสตรีท mG  ๑
   ARG25102503821594 จ -
COJEV15ONDLV        งซี
เลขที่รายการ:
015298175028/เว16903  [m]% ร: [=]
จํานวน:
15.00 บาท A= Ek 3
ค่าธรรมเนียม:                           [=]: No ๒
S 08          0.00 บาท   สแกนตรวจสอบสลิป`;

console.log('Raw OCR Text (problematic section):');
console.log('015298175028/เว16903\n');

console.log('Expected Result:');
console.log('015298175028APM16903\n');

console.log('Testing OCR cleaning...\n');

// Test the cleaning function
const cleaned = ocrService.cleanOCRText(problematicOCR);
console.log('Cleaned text (key parts):');
console.log(cleaned.substring(cleaned.indexOf('0152'), cleaned.indexOf('0152') + 30));
console.log();

// Test transaction ID extraction
const extractedId = ocrService.extractTransactionId(problematicOCR);
console.log('Extracted Transaction ID:', extractedId);
console.log('Length:', extractedId ? extractedId.length : 0);
console.log('Valid format?', extractedId && /^0152\d{8}[A-Z0-9]{4}\d{3,5}$/.test(extractedId));

if (extractedId === '015298175028APM16903') {
  console.log('\n✅ SUCCESS: Correctly extracted transaction ID!');
} else {
  console.log('\n❌ FAILED: Expected 015298175028APM16903 but got', extractedId);
}

// Test additional OCR misreading cases
console.log('\n\n=== ADDITIONAL TEST CASES ===\n');

const testCases = [
  {
    name: 'Thai /เว should become APM',
    input: '015298175028/เว16903',
    expected: '015298175028APM16903'
  },
  {
    name: 'Thai เอ should become A',
    input: '0152981708เอTF05812',
    expected: '015298170ATF05812'
  },
  {
    name: 'Mixed Thai numbers',
    input: '๐๑๕๒98175028APM16903',
    expected: '015298175028APM16903'
  },
  {
    name: 'Thai บี should become B',
    input: '015298175028บีQR02651',
    expected: '015298175028BQR02651'
  }
];

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.name}`);
  console.log(`  Input:    ${testCase.input}`);
  
  const result = ocrService.extractTransactionId(testCase.input);
  console.log(`  Output:   ${result}`);
  console.log(`  Expected: ${testCase.expected}`);
  console.log(`  Status:   ${result === testCase.expected ? '✅ PASS' : '❌ FAIL'}`);
  console.log();
});

console.log('=== TEST COMPLETED ===');

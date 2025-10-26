/**
 * Test Thai OCR character fix for the problematic slip
 * Raw text: "0152981708198ดู802651"
 * Expected: "015298170819BQR02651"
 */

const ocrService = require('./src/services/ocrService');

console.log('=== Testing Thai Character OCR Fix ===\n');

// Test data from the problematic slip
const rawText = `ชําระเงินสําเร็จ
25 ต.ุค. 68 17:08 น.                                I<

นาย ปัณณธร บ

ธ.กสิกรไทย
XXX-X-X8700-x

ชัน

ป.เพย์ โซลูชัน an.

บจก. เพย์ โซลูชัน
202510255360001

เลขที่รายการ:
0152981708198ดู802651

จํานวน:
40.00 บาท

ค่าธรรมเนียม:

0.00 บาท       สแกนตรวจสอบสลิป`;

console.log('Original Raw Text:');
console.log(rawText);
console.log('\n' + '='.repeat(60) + '\n');

// Test 1: Clean OCR text
console.log('Test 1: Clean OCR Text');
const cleanedText = ocrService.cleanOCRText(rawText);
console.log('Result:', cleanedText);
console.log('\n' + '-'.repeat(60) + '\n');

// Test 2: Extract transaction ID
console.log('Test 2: Extract Transaction ID');
const transactionId = ocrService.extractTransactionId(rawText);
console.log('Extracted ID:', transactionId);
console.log('Expected ID:  015298170819BQR02651');
console.log('Match:', transactionId === '015298170819BQR02651' ? '✅ SUCCESS' : '❌ FAILED');
console.log('\n' + '-'.repeat(60) + '\n');

// Test 3: Fix transaction ID errors directly
console.log('Test 3: Direct Fix of "0152981708198ดู802651"');
const problematicId = '0152981708198ดู802651';
const fixed = ocrService.fixTransactionIdOCRErrors(problematicId);
console.log('Input:  ', problematicId);
console.log('Fixed:  ', fixed);
console.log('Expected:', '015298170819BQR02651');
console.log('Match:', fixed === '015298170819BQR02651' ? '✅ SUCCESS' : '❌ FAILED');
console.log('\n' + '-'.repeat(60) + '\n');

// Test 4: Extract amount
console.log('Test 4: Extract Amount');
const amount = ocrService.extractAmount(rawText);
console.log('Extracted:', amount, 'บาท');
console.log('Expected: 40 บาท');
console.log('Match:', amount === 40 ? '✅ SUCCESS' : '❌ FAILED');
console.log('\n' + '-'.repeat(60) + '\n');

// Test 5: Extract date/time
console.log('Test 5: Extract Date/Time');
const dateTime = ocrService.extractDateTime(rawText);
console.log('Extracted:', JSON.stringify(dateTime, null, 2));
console.log('\n' + '-'.repeat(60) + '\n');

// Test 6: More Thai character patterns
console.log('Test 6: Additional Thai Character Patterns');
const testCases = [
  { input: '0152981708198ดู802651', expected: '015298170819BQR02651' },
  { input: '01529817081980802651', expected: '015298170819BQR02651' }, // If 8XX8 pattern
  { input: '0152981708198คิวอาร์802651', expected: '015298170819QR802651' },
  { input: '01529817081980082651', expected: '015298170819BQR02651' }
];

testCases.forEach((test, index) => {
  const result = ocrService.fixTransactionIdOCRErrors(test.input);
  const match = result === test.expected;
  console.log(`Case ${index + 1}:`);
  console.log(`  Input:    ${test.input}`);
  console.log(`  Output:   ${result}`);
  console.log(`  Expected: ${test.expected}`);
  console.log(`  Status:   ${match ? '✅ PASS' : '❌ FAIL'}`);
  console.log();
});

console.log('=== Test Complete ===');

# KBank Slip Verification API

ระบบตรวจสอบความถูกต้องของสลิปโอนเงิน KBank โดยใช้ OCR อ่านข้อมูลจากรูปภาพและตรวจสอบความสอดคล้องของข้อมูล

## คุณสมบัติ

- 🔍 **OCR อ่านสลิป**: ใช้ Tesseract.js อ่านข้อมูลจากรูปสลิป (ภาษาไทย + อังกฤษ)
- 🔐 **ตรวจสอบเลขธุรกรรม**: วิเคราะห์รูปแบบเลขที่รายการ KBank (Format: 0152 + YYHHMMSS + TYPE + SEQ)
- ✅ **ตรวจสอบความถูกต้อง**: เปรียบเทียบเวลา จำนวนเงิน และข้อมูลอื่นๆ ในสลิป
- 📊 **คะแนนความน่าเชื่อถือ**: ให้คะแนนและรายงานผลการตรวจสอบ
- 🚀 **REST API**: เรียกใช้งานง่ายผ่าน HTTP requests

## โครงสร้างเลขที่รายการ KBank

```
0152 YY HH MM SS TTTT SSSS
```

| ส่วน | ตัวอย่าง | ความหมาย |
|------|----------|----------|
| 0152 | 0152 | Prefix ของ KBank |
| YY | 98 | รหัสปี (68 → 98 ในระบบ, หมายถึง 2568) |
| HHMMSS | 170819 | เวลา 17:08:19 |
| TTTT | BQR0, BPMO, ATF0 | ประเภทธุรกรรม |
| SSSS | 2651 | ลำดับธุรกรรม |

### ประเภทธุรกรรม

- `BQR0` - Bill QR Payment (จ่ายบิลผ่าน QR)
- `BPMO` - Bill Payment Mobile Online (จ่ายบิลออนไลน์)
- `ATF0` - Account Transfer via Mobile (โอนบัญชีผ่านมือถือ)
- `APM` - App Payment (จ่ายผ่านแอป)
- `ATMO` - Account Transfer Mobile Online

## การติดตั้ง

### 1. Clone repository

```bash
git clone <repository-url>
cd slip-verification-API-
```

### 2. ติดตั้ง dependencies

```bash
npm install
```

### 3. สร้างไฟล์ .env

```bash
cp .env.example .env
```

แก้ไขค่าใน `.env` ตามต้องการ:

```env
PORT=3000
NODE_ENV=development
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/jpg
OCR_LANGUAGE=tha+eng
```

### 4. เริ่มต้นใช้งาน

```bash
# Development mode
npm run dev

# Production mode
npm start
```

API จะทำงานที่ `http://localhost:3000`

## API Endpoints

### 1. ตรวจสอบสลิปแบบสมบูรณ์

**POST** `/api/slip/verify`

อัปโหลดรูปสลิปเพื่อตรวจสอบความถูกต้อง

**Request (multipart/form-data):**
- `slip` (file): ไฟล์รูปภาพ (JPEG, PNG)
- `expectedAmount` (optional): จำนวนเงินที่คาดหวัง
- `expectedRecipient` (optional): ชื่อผู้รับที่คาดหวัง

**Response:**
```json
{
  "success": true,
  "validation": {
    "valid": true,
    "score": 85,
    "maxScore": 100,
    "scorePercentage": 85,
    "errors": [],
    "warnings": [],
    "details": {
      "transactionInfo": {
        "raw": "015298170819BQR02651",
        "valid": true,
        "prefix": "0152",
        "year": 2568,
        "time": "17:08:19",
        "type": "BQR0",
        "typeDescription": "Bill QR Payment"
      },
      "timeValidation": {
        "valid": true,
        "message": "Time matches between slip and transaction ID"
      }
    }
  },
  "slipData": {
    "transactionId": "015298170819BQR02651",
    "amount": 40.00,
    "dateTime": {
      "day": 25,
      "year": 2568,
      "time": "17:08"
    },
    "recipient": "นาย ปัณฑร บ",
    "ocrConfidence": 87.5
  },
  "report": "=== SLIP VALIDATION REPORT ===\n..."
}
```

### 2. แยกข้อมูลจากสลิป (ไม่ตรวจสอบ)

**POST** `/api/slip/parse`

อัปโหลดรูปสลิปเพื่อแยกข้อมูลเท่านั้น ไม่ทำการตรวจสอบความถูกต้อง

**Request (multipart/form-data):**
- `slip` (file): ไฟล์รูปภาพ

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "ocrConfidence": 87.5,
    "transactionId": "015298170819BQR02651",
    "amount": 40.00,
    "dateTime": {
      "day": 25,
      "year": 2568,
      "time": "17:08"
    },
    "recipient": "นาย ปัณฑร บ",
    "rawText": "..."
  }
}
```

### 3. ตรวจสอบเลขธุรกรรม

**POST** `/api/slip/validate-transaction-id`

ตรวจสอบความถูกต้องของเลขที่รายการ (ไม่ต้องอัปโหลดรูป)

**Request (JSON):**
```json
{
  "transactionId": "015298170819BQR02651"
}
```

**Response:**
```json
{
  "success": true,
  "validation": {
    "valid": true,
    "transactionId": "015298170819BQR02651",
    "parsed": {
      "raw": "015298170819BQR02651",
      "valid": true,
      "prefix": "0152",
      "year": 2568,
      "time": "17:08:19",
      "type": "BQR0",
      "typeDescription": "Bill QR Payment",
      "sequence": "2651"
    },
    "message": "Valid KBank transaction ID"
  }
}
```

### 4. แยกข้อมูลจากเลขธุรกรรม

**POST** `/api/slip/parse-transaction-id`

แยกข้อมูลจากเลขที่รายการ

**Request (JSON):**
```json
{
  "transactionId": "015298170819BQR02651"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "raw": "015298170819BQR02651",
    "valid": true,
    "prefix": "0152",
    "year": 2568,
    "time": "17:08:19",
    "hour": 17,
    "minute": 8,
    "second": 19,
    "type": "BQR0",
    "typeDescription": "Bill QR Payment",
    "sequence": "2651"
  }
}
```

### 5. Health Check

**GET** `/api/slip/health`

ตรวจสอบสถานะของ API

**Response:**
```json
{
  "success": true,
  "status": "OK",
  "timestamp": "2024-10-26T13:00:00.000Z"
}
```

## ตัวอย่างการใช้งาน

### cURL

```bash
# ตรวจสอบสลิป
curl -X POST http://localhost:3000/api/slip/verify \
  -F "slip=@/path/to/slip.jpg" \
  -F "expectedAmount=40.00"

# ตรวจสอบเลขธุรกรรม
curl -X POST http://localhost:3000/api/slip/validate-transaction-id \
  -H "Content-Type: application/json" \
  -d '{"transactionId":"015298170819BQR02651"}'
```

### JavaScript (Fetch API)

```javascript
// อัปโหลดและตรวจสอบสลิป
const formData = new FormData();
formData.append('slip', fileInput.files[0]);
formData.append('expectedAmount', '40.00');

const response = await fetch('http://localhost:3000/api/slip/verify', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(result);
```

### Python (requests)

```python
import requests

# อัปโหลดและตรวจสอบสลิป
with open('slip.jpg', 'rb') as f:
    files = {'slip': f}
    data = {'expectedAmount': '40.00'}
    response = requests.post(
        'http://localhost:3000/api/slip/verify',
        files=files,
        data=data
    )
    print(response.json())
```

## โครงสร้างโปรเจค

```
slip-verification-API-/
├── src/
│   ├── routes/
│   │   └── slipRoutes.js          # API routes
│   ├── services/
│   │   ├── ocrService.js          # OCR และการแยกข้อมูล
│   │   └── validationService.js   # ตรวจสอบความถูกต้อง
│   ├── utils/
│   │   └── transactionParser.js   # แยกวิเคราะห์เลขธุรกรรม
│   └── server.js                  # Main server
├── package.json
├── .env.example
└── README.md
```

## เทคโนโลยีที่ใช้

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Tesseract.js** - OCR engine สำหรับอ่านข้อความจากรูปภาพ
- **Sharp** - Image processing สำหรับปรับปรุงคุณภาพรูปก่อน OCR
- **Multer** - File upload middleware

## การตรวจสอบความถูกต้อง

ระบบจะให้คะแนนจากหลายปัจจัย:

1. **เลขธุรกรรมถูกต้อง** (จำเป็น)
2. **เวลาตรงกัน** (30 คะแนน) - ระหว่างสลิปกับเลขธุรกรรม
3. **มีจำนวนเงิน** (20 คะแนน)
4. **จำนวนเงินตรงกัน** (20 คะแนน) - ถ้ามีการระบุมา
5. **ชื่อผู้รับตรงกัน** (15 คะแนน) - ถ้ามีการระบุมา
6. **คุณภาพ OCR ดี** (15 คะแนน)

**ผ่านการตรวจสอบ** = ไม่มี errors และได้คะแนน ≥ 70%

## ข้อจำกัด

- รองรับเฉพาะสลิป KBank (K PLUS)
- ต้องเป็นรูปภาพที่ชัดเจน คุณภาพดี
- OCR อาจอ่านผิดได้ในบางกรณี โดยเฉพาะภาษาไทย

## License

ISC

## ผู้พัฒนา

ระบบนี้พัฒนาขึ้นเพื่อตรวจสอบความถูกต้องของสลิปโอนเงิน KBank โดยอัตโนมัติ

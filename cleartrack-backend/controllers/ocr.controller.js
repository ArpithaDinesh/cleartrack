const path = require('path');
const fs = require('fs');
const os = require('os');
const sharp = require('sharp');
const util = require('util');
const { createWorker } = require('tesseract.js');

const ClearanceRequest = require('../models/ClearanceRequest');

// Use sharp (built-in JS) for preprocessing — much faster and works on Vercel
const runSharpPreprocess = async (inputPath) => {
  const ext = path.extname(inputPath);
  const cleanedPath = path.join(os.tmpdir(), `cleaned-${Date.now()}${ext}`);
  try {
    console.log('Running sharp preprocessing...');
    await sharp(inputPath)
      .grayscale() // OCR works better on grayscale
      .resize(2000, null, { withoutEnlargement: true }) // Upscale if needed for better character recognition
      .normalize() // Enhances contrast
      .toFile(cleanedPath);
    console.log('Sharp preprocessing done.');
    return cleanedPath;
  } catch (err) {
    console.warn('Sharp preprocess skipped:', err.message);
    return inputPath;
  }
};

// Parse key fields from OCR raw text
const parseOCRFields = (rawText) => {
  const text = rawText.toUpperCase();
  const result = {
    studentName: '',
    department: '',
    feeCategory: '',
    transactionId: '',
    amount: '',
    paymentDate: '',
    receiptNumber: '',
    bankName: '',
    paymentMode: '',
    rawText
  };

  // ── 1. Receipt Number  ──────────────────────────────────────────────────────
  // Matches: "No.F 1262", "No. 1262", "Receipt No: 1234", "No F 1262"
  const rcptPatterns = [
    /No\.?\s*F\s*(\d{3,6})/i,
    /RECEIPT\s*(?:NO|NUMBER|#)[\s:.]*([A-Z0-9\-]{3,12})/i,
    /R\.?NO[\s:.]*([A-Z0-9\-]{3,12})/i,
    /CHALAN\s*\/\s*VR\.?\s*NO[\s:.]*([A-Z0-9\/\-]{3,12})/i,
  ];
  for (const p of rcptPatterns) {
    const m = rawText.match(p);
    if (m && m[1]) { result.receiptNumber = m[1].trim(); break; }
  }

  // ── 2. Particulars — "By Cash [Name] [Dept] [Fee Type]"  ───────────────────
  // Used on Kadirur / College cash receipts
  const DEPTS = 'IT|CSE|ME|EE|EC|MCA|MBA|CIVIL|ECE|EEE|BCA|BBA|MTECH|BE';
  const particularsRx = new RegExp(
    `BY\\s+CASH\\s+([A-Z][A-Z.\\s]{2,})\\s+(${DEPTS})\\b\\s*(.*)`, 'i'
  );
  const pm = rawText.match(particularsRx);
  if (pm) {
    result.studentName = pm[1].trim().replace(/\s{2,}/g, ' ');
    result.department  = pm[2].trim().toUpperCase();
    // Clean fee category: remove noise words like NEW, strip trailing/leading spaces
    const rawCat = pm[3].trim();
    result.feeCategory = normalizeFeeCategory(rawCat);
    result.paymentMode = 'Cash';
  }

  // ── 2b. Fallback Student Name ───────────────────────────────────────────────
  if (!result.studentName) {
    const namePatterns = [
      /(?:CUSTOMER\s*NAME|STUDENT\s*NAME|NAME)[\s:#]*([A-Z][A-Z.\s]{2,})/i,
      /REMITTED\s+BY\s+([A-Z][A-Z\s]{2,})/i,
    ];
    const ignoreWords = ['COLLEGE', 'ENGINEERING', 'OFFICER', 'REMITTED', 'BANK',
      'SERVICE', 'COOPERATIVE', 'THALASSERY', 'KANNUR', 'KADIRUR', 'TRANSFER',
      'RECEIPT', 'CASHIER', 'AUTHORISED', 'DEPOSIT'];
    for (const p of namePatterns) {
      const m = rawText.match(p);
      if (m && m[1]) {
        let name = m[1].replace(/College of Engineering/ig, '').trim();
        const invalid = ignoreWords.some(w => name.toUpperCase().includes(w));
        if (name.length > 2 && !invalid) {
          result.studentName = name.replace(/\d+/g, '').trim();
          break;
        }
      }
    }
  }

  // ── 3. Transaction / Chalan ID ─────────────────────────────────────────────
  const txnPatterns = [
    /TXN[\s:#]*([A-Z0-9]+)/i,
    /TRANSACTION[\s:#]*ID[\s:]*([A-Z0-9\-]+)/i,
    /UTR[\s:#]*([A-Z0-9\-]{10,})/i,
    /CHALAN\s*\/\s*VR\.?\s*NO[\s:]*([A-Z0-9\/\-]{4,})/i,
    /JOURNAL[\s:]*([A-Z0-9]+)/i,
    /REF[\s:#]*([A-Z0-9\-]{6,})/i,
    /(\d{10,18})/,
  ];
  for (const p of txnPatterns) {
    const m = rawText.match(p);
    if (m) {
      const val = (m[1] || m[0]).replace(/\s/g, '').toUpperCase();
      if (!/DATE|AMOUNT|RS|INR|BANK/i.test(val) && val.length > 5) {
        result.transactionId = val;
        break;
      }
    }
  }

  // ── 4. Amount ──────────────────────────────────────────────────────────────
  // Primary: keyword-anchored (RS / AMOUNT / TOTAL / NET)
  const kwAmtRx = /(?:RS\.?|AMT|AMOUNT|TOTAL|NET)\s*:?\s*([\d,.\s]{3,15})/i;
  const kwMatch = rawText.match(kwAmtRx);
  if (kwMatch) {
    const clean = sanitizeAmount(kwMatch[1]);
    if (clean) result.amount = '₹' + clean;
  }

  // Secondary: look for Indian currency format  e.g. 45,770.00 or 45770.00
  if (!result.amount) {
    const candidates = rawText.match(/\b(\d{1,3}(?:[,\s]\d{3})*(?:\.\d{1,2})?)\b/g) || [];
    for (const c of candidates) {
      const clean = sanitizeAmount(c);
      const val = parseFloat(clean);
      if (val >= 100 && val <= 300000) {
        result.amount = '₹' + clean;
        break;
      }
    }
  }

  // Tertiary: OCR-misread characters (L→1, S→5, O→0)
  if (!result.amount) {
    const fuzzy = rawText.match(/[0-9LS]{2,}[.,\/4][0-9LS]{2}/ig) || [];
    for (const f of fuzzy) {
      const clean = sanitizeAmount(f.replace(/L/g, '1').replace(/S/g, '5').replace(/O/g, '0').replace(/4/g, '.'));
      const val = parseFloat(clean);
      if (val >= 100 && val <= 300000) {
        result.amount = '₹' + clean;
        break;
      }
    }
  }

  // ── 5. Date ────────────────────────────────────────────────────────────────
  // Anchored first (most reliable), then plain patterns
  const datePatterns = [
    /DATE\s*:?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/,
    /(\d{1,2}\s+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\w*\s+\d{2,4})/i,
    /(\d{2}\s+\w{3}\s+\d{4})/,
  ];
  for (const p of datePatterns) {
    const m = rawText.match(p);
    if (m) { result.paymentDate = m[1].trim(); break; }
  }

  // ── 6. Bank Name ───────────────────────────────────────────────────────────
  const bankMap = {
    'KADIRUR SERVICE CO-OPERATIVE': 'Kadirur Service Co-operative Bank',
    'KADIRUR': 'Kadirur Service Co-operative Bank',
    'CO-OPERATIVE': 'Co-operative Bank',
    'COOPERATIVE': 'Co-operative Bank',
    'KERALA BANK': 'Kerala Bank',
    'SOUTH INDIAN': 'South Indian Bank',
    'FEDERAL': 'Federal Bank',
    'SBI': 'State Bank of India',
    'HDFC': 'HDFC Bank',
    'ICICI': 'ICICI Bank',
    'AXIS': 'Axis Bank',
    'PNB': 'Punjab National Bank',
    'BOB': 'Bank of Baroda',
    'CANARA': 'Canara Bank',
    'UNION': 'Union Bank',
    'KOTAK': 'Kotak Mahindra Bank',
  };
  for (const [keyword, fullName] of Object.entries(bankMap)) {
    if (text.includes(keyword)) { result.bankName = fullName; break; }
  }

  // ── 7. Payment Mode ────────────────────────────────────────────────────────
  if (!result.paymentMode) {
    if (/\bUPI\b/i.test(rawText))                     result.paymentMode = 'UPI';
    else if (/NEFT|RTGS|IMPS/i.test(rawText))         result.paymentMode = rawText.match(/NEFT|RTGS|IMPS/i)[0].toUpperCase();
    else if (/CHALAN|CHALLAN/i.test(rawText))          result.paymentMode = 'DD / Challan';
    else if (/BY\s+CASH|CASH\s+PAYMENT/i.test(rawText)) result.paymentMode = 'Cash';
    else if (/ONLINE|TRANSFER/i.test(rawText))         result.paymentMode = 'Online Transfer';
  }

  return result;
};

// Helper: strip commas/spaces from a number string and validate
const sanitizeAmount = (str) => {
  const clean = str.replace(/[\s,]/g, '');
  return isNaN(parseFloat(clean)) ? null : clean;
};

// Helper: normalise fee category from OCR particulars
const normalizeFeeCategory = (raw) => {
  // Remove noise filler words
  let cat = raw.replace(/\b(NEW|THE|AND|OF|FOR|A|AN)\b/gi, ' ')
               .replace(/\s{2,}/g, ' ')
               .trim();
  // Title-case and map to standard labels
  const lower = cat.toLowerCase();
  if (/admission/i.test(lower))    return 'Admission Fee';
  if (/tution|tuition/i.test(lower)) return 'Tuition Fee';
  if (/hostel/i.test(lower))       return 'Hostel Fee';
  if (/bus|transport/i.test(lower)) return 'Bus Fee';
  if (/exam/i.test(lower))         return 'Exam Fee';
  if (/re.?admission/i.test(lower)) return 'Re-Admission Fee';
  // Return cleaned raw if no match
  return cat.length > 0 ? cat : raw.trim();
};


// @desc  Process OCR on uploaded receipt
// @route POST /api/ocr/process/:requestId
// Internal helper to process OCR — shared by routes and auto-trigger
const processOCRInternal = async (request, user) => {
  let preprocessedPath = null;
  try {
    const filePath = request.receiptFile?.path;
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error('Receipt file not found on server.');
    }

    // Step 1: Image preprocessing
    let ocrInputPath = filePath;
    try {
      preprocessedPath = await runSharpPreprocess(filePath);
      ocrInputPath = preprocessedPath;
    } catch (e) {
      console.warn('Skipping preprocessing step:', e.message);
    }

    // Step 2: Run tesseract.js with optimized config
    console.log('Running tesseract.js OCR on:', ocrInputPath);
    const worker = await createWorker('eng', 1, {
      cachePath: path.join(os.tmpdir(), 'tessdata'),
      logger: m => { 
        if (m.status === 'recognizing text') {
          console.log(`OCR Progress: ${Math.round((m.progress || 0) * 100)}%`);
        }
      }
    });
    const { data: { text: rawText } } = await worker.recognize(ocrInputPath);
    await worker.terminate();

    const ocrData = parseOCRFields(rawText);

    // Step 3: Save to DB
    request.ocrData = ocrData;
    request.overallStatus = request.overallStatus === 'submitted' ? 'under_review' : request.overallStatus;
    await request.save();

    return { ocrData, rawText };

  } finally {
    if (preprocessedPath && fs.existsSync(preprocessedPath)) {
      try { fs.unlinkSync(preprocessedPath); } catch(e) {}
    }
  }
};

// @desc  Process OCR on uploaded receipt
// @route POST /api/ocr/process/:requestId
const processOCR = async (req, res) => {
  try {
    const request = await ClearanceRequest.findById(req.params.requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    if (request.student.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const { ocrData, rawText } = await processOCRInternal(request, req.user);
    res.json({ success: true, ocrData, requestId: request._id, rawText });

  } catch (err) {
    console.error('OCR Route Error:', err);
    res.status(500).json({ success: false, message: 'OCR processing failed: ' + err.message });
  }
};

// @desc  Student confirms OCR data
// @route PATCH /api/ocr/confirm/:requestId
const confirmOCR = async (req, res) => {
  try {
    const request = await ClearanceRequest.findById(req.params.requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }
    if (request.student.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const { studentName, department, feeCategory, transactionId, amount, paymentDate, receiptNumber, bankName, paymentMode } = req.body;
    if (studentName) request.ocrData.studentName = studentName;
    if (department) request.ocrData.department = department;
    if (feeCategory) request.ocrData.feeCategory = feeCategory;
    if (transactionId) request.ocrData.transactionId = transactionId;
    if (amount) request.ocrData.amount = amount;
    if (paymentDate) request.ocrData.paymentDate = paymentDate;
    if (receiptNumber) request.ocrData.receiptNumber = receiptNumber;
    if (bankName) request.ocrData.bankName = bankName;
    if (paymentMode) request.ocrData.paymentMode = paymentMode;

    request.ocrData.studentConfirmed = true;
    request.ocrData.confirmedAt = new Date();
    await request.save();

    res.json({ success: true, ocrData: request.ocrData });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { processOCR, confirmOCR, processOCRInternal };

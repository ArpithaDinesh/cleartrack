const path = require('path');
const fs = require('fs');
const os = require('os');
const { createWorker } = require('tesseract.js');

const ClearanceRequest = require('../models/ClearanceRequest');

// ─── Sharp (optional image preprocessing) ───────────────────────────────────
let sharp = null;
try { sharp = require('sharp'); } catch (e) {
  console.warn('⚠️  sharp not available — skipping image preprocessing.');
}

// ─── Singleton Tesseract Worker ──────────────────────────────────────────────
// We create ONE worker at startup and reuse it for all requests.
// This eliminates the 5-15s init delay on every upload.
let workerReady = null; // Promise<worker>

const getWorker = () => {
  if (!workerReady) {
    console.log('🔧 Initializing Tesseract worker (one-time startup)...');
    workerReady = (async () => {
      const w = await createWorker('eng', 1, {
        cachePath: path.join(__dirname, '..', 'tessdata'),
        logger: () => {}, // silence per-character progress spam
      });
      await w.setParameters({
        tessedit_pageseg_mode: '6',   // uniform block of text
        tessedit_ocr_engine_mode: '1', // LSTM only (faster than combined)
        preserve_interword_spaces: '1',
      });
      console.log('✅ Tesseract worker ready.');
      return w;
    })().catch(err => {
      // Reset so next call retries
      workerReady = null;
      throw err;
    });
  }
  return workerReady;
};

// Pre-warm the worker immediately when the module loads
getWorker().catch(err => console.error('Worker pre-warm failed:', err.message));

// ─── Image Preprocessing ─────────────────────────────────────────────────────
const preprocessImage = async (inputPath) => {
  if (!sharp) return inputPath;
  const outPath = path.join(os.tmpdir(), `ocr-${Date.now()}.png`);
  try {
    await sharp(inputPath)
      .rotate()                                    // auto-rotate via EXIF
      .resize({ width: 1400, withoutEnlargement: false })
      .grayscale()
      .normalise()
      .linear(1.5, -(1.5 * 128 - 128))
      .sharpen({ sigma: 1.2, m1: 1, m2: 2 })
      .threshold(155)
      .png({ compressionLevel: 1 })
      .toFile(outPath);
    return outPath;
  } catch (err) {
    console.warn('Preprocessing failed, using original:', err.message);
    return inputPath;
  }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const sanitizeAmount = (str = '') => {
  const clean = str.replace(/[\s,]/g, '');
  const val = parseFloat(clean);
  return isNaN(val) ? null : clean;
};

const normalizeFeeCategory = (raw = '') => {
  const t = raw.replace(/\b(NEW|THE|AND|OF|FOR|A|AN|FEE|F|EF|LI)\b/gi, ' ')
               .replace(/[^A-Z\s]/gi, ' ')
               .replace(/\s{2,}/g, ' ').trim();
  const up = t.toUpperCase();
  if (/ADMIS/i.test(up))                       return 'Admission Fee';
  if (/TUI[TL][LI]?[OQ]N|TUITION/i.test(up))  return 'Tuition Fee';
  if (/HOSTEL/i.test(up))                       return 'Hostel Fee';
  if (/BUS|TRANSPORT/i.test(up))               return 'Bus Fee';
  if (/EXAM/i.test(up))                         return 'Exam Fee';
  if (/RE.?ADMI/i.test(up))                    return 'Re-Admission Fee';
  return t.length > 1 ? t : raw.trim();
};

const IGNORE_WORDS = new Set([
  'COLLEGE','ENGINEERING','BANK','SERVICE','CO','OP','COOPERATIVE',
  'KADIRUR','CASHIER','OFFICER','REMITTED','TRANSFER','RECEIPT','DEPOSIT',
  'SAVINGS','AUTHORISED','AUTHORIZ',
]);

const extractCleanName = (raw = '') => {
  const tokens = raw.split(/\s+/).filter(t => {
    if (t.length < 2) return false;
    if (/\d/.test(t)) return false;
    if (IGNORE_WORDS.has(t.toUpperCase())) return false;
    const letterRatio = (t.match(/[A-Za-z]/g) || []).length / t.length;
    return letterRatio >= 0.7;
  });
  return tokens.slice(0, 3)
    .map(t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())
    .join(' ');
};

// ─── Parser ───────────────────────────────────────────────────────────────────
const parseOCRFields = (rawText) => {
  const lines   = rawText.split(/\r?\n/);
  const oneLine = rawText.replace(/\r?\n/g, ' ').replace(/\s{2,}/g, ' ');
  const UP      = oneLine.toUpperCase();

  const result = {
    studentName: '', department: '', feeCategory: '',
    transactionId: '', amount: '', paymentDate: '',
    receiptNumber: '', bankName: '', paymentMode: '', rawText,
  };

  // 1. Receipt Number
  for (const p of [
    /No\.?\s*F[\s\-]*(\d{3,6})/i,
    /RECEIPT\s*(?:NO|#)[\s:.]*([A-Z0-9\-]{3,12})/i,
    /CHALAN\s*[\/\\]\s*VR\.?\s*NO[\s:.]*([A-Z0-9\/\-]{3,12})/i,
  ]) {
    const m = oneLine.match(p);
    if (m?.[1]) { result.receiptNumber = m[1].trim(); break; }
  }

  // 2. Student Name + Dept + Fee Category
  const DEPTS = 'IT|CSE|ME|EE|EC|MCA|MBA|CIVIL|ECE|EEE|BCA|BBA|MTECH|BE';

  // 2a. "By Cash [Name] [Dept] [FeeType]"
  const cashM = oneLine.match(new RegExp(`BY\\s+CASH\\s+([A-Z][A-Z.\\s]{2,?})\\s+(${DEPTS})\\b\\s*(.{0,60})`, 'i'));
  if (cashM) {
    result.studentName = cashM[1].trim().replace(/\s{2,}/g, ' ');
    result.department  = cashM[2].toUpperCase();
    result.feeCategory = normalizeFeeCategory(cashM[3]);
    result.paymentMode = 'Cash';
  }

  // 2b. "Particulars" block
  if (!result.studentName) {
    const partIdx = lines.findIndex(l => /particulars/i.test(l));
    if (partIdx >= 0) {
      const partLines = lines.slice(partIdx + 1, partIdx + 8)
        .map(l => l.trim()).filter(Boolean);
      const partBlock = partLines.join(' ');
      const dM = partBlock.match(new RegExp(`\\b(${DEPTS})\\b`, 'i'));
      if (dM) {
        result.department  = dM[1].toUpperCase();
        const before = partBlock.slice(0, partBlock.toUpperCase().indexOf(dM[1].toUpperCase())).trim();
        result.studentName = extractCleanName(before);
        const after = partBlock.slice(partBlock.toUpperCase().indexOf(dM[1].toUpperCase()) + dM[1].length).trim();
        result.feeCategory = normalizeFeeCategory(after);
      } else {
        result.studentName = extractCleanName(partLines[0] || '');
        result.feeCategory = normalizeFeeCategory(partLines.slice(1).join(' '));
      }
    }
  }

  // 2c. "Customer Name" label fallback
  if (!result.studentName) {
    const cnM = oneLine.match(/CUSTOMER\s*NAME[\s:#]*([A-Z][A-Z.\s]{2,40}?)(?:\s{3,}|$)/i);
    if (cnM?.[1]) {
      const n = cnM[1].replace(/College of Engineering/ig, '').trim();
      if (!['COLLEGE','ENGINEERING','BANK','SERVICE','COOPERATIVE','KADIRUR','CASHIER'].some(w => n.toUpperCase().includes(w))) {
        result.studentName = n.replace(/\d+/g, '').trim();
      }
    }
  }

  // 3. Amount
  const totalM = oneLine.match(/[Tt]otal\s*[=:]\s*([\d,\s]+\.?\s*\d{0,2})/i);
  if (totalM) {
    const clean = sanitizeAmount(totalM[1]);
    const val   = parseFloat(clean);
    if (val >= 100 && val <= 300000) result.amount = '₹' + clean;
  }

  if (!result.amount) {
    const kwM = oneLine.match(/(?:RS\.?|AMT|AMOUNT)\s*:?\s*([\d,.\s]{3,15})/i);
    if (kwM) {
      const clean = sanitizeAmount(kwM[1]);
      if (clean) result.amount = '₹' + clean;
    }
  }

  if (!result.amount) {
    const decimals = [...oneLine.matchAll(/\b(\d{1,3}(?:[,\s]\d{3})*\.\d{1,2})\b/g)];
    for (const [, raw] of decimals) {
      const clean = sanitizeAmount(raw);
      const val   = parseFloat(clean);
      if (val >= 100 && val <= 300000) { result.amount = '₹' + clean; break; }
    }
  }

  if (!result.amount) {
    const fuzzy = [...oneLine.matchAll(/[0-9LS]{2,}[.,][0-9LS]{2}/gi)];
    for (const [raw] of fuzzy) {
      const fixed = raw.replace(/L/g,'1').replace(/S/g,'5').replace(/O/g,'0');
      const clean = sanitizeAmount(fixed);
      const val   = parseFloat(clean);
      if (val >= 100 && val <= 300000) { result.amount = '₹' + clean; break; }
    }
  }

  // 4. Date
  for (const p of [
    /DATE\s*:?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/,
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2})/,
    /(\d{1,2}\s+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\w*\s+\d{2,4})/i,
  ]) {
    const m = oneLine.match(p);
    if (m?.[1]) { result.paymentDate = m[1].trim(); break; }
  }

  // 5. Transaction ID
  for (const p of [
    /TXN[\s:#]*([A-Z0-9]{6,})/i,
    /UTR[\s:#]*([A-Z0-9\-]{10,})/i,
    /CHALAN\s*[\/\\]\s*VR\.?\s*NO[\s:.]*([A-Z0-9\/\-]{4,})/i,
    /REF(?:ERENCE)?[\s:#]*([A-Z0-9\-]{8,})/i,
    /(\d{12,18})/,
  ]) {
    const m = oneLine.match(p);
    if (m?.[1]) {
      const val = m[1].replace(/\s/g,'').toUpperCase();
      if (!/DATE|AMOUNT|RS|INR|BANK/i.test(val)) { result.transactionId = val; break; }
    }
  }

  // 6. Bank Name
  const bankMap = [
    ['KADIRUR SERVICE CO-OP', 'Kadirur Service Co-operative Bank'],
    ['KADIRUR',               'Kadirur Service Co-operative Bank'],
    ['CO-OPERATIVE',          'Co-operative Bank'],
    ['COOPERATIVE',           'Co-operative Bank'],
    ['KERALA BANK',           'Kerala Bank'],
    ['SOUTH INDIAN',          'South Indian Bank'],
    ['FEDERAL',               'Federal Bank'],
    ['SBI',                   'State Bank of India'],
    ['HDFC',                  'HDFC Bank'],
    ['ICICI',                 'ICICI Bank'],
    ['AXIS',                  'Axis Bank'],
    ['PNB',                   'Punjab National Bank'],
    ['BOB',                   'Bank of Baroda'],
    ['CANARA',                'Canara Bank'],
    ['UNION',                 'Union Bank of India'],
    ['KOTAK',                 'Kotak Mahindra Bank'],
  ];
  for (const [kw, name] of bankMap) {
    if (UP.includes(kw)) { result.bankName = name; break; }
  }

  // 7. Payment Mode
  if (!result.paymentMode) {
    if      (/\bUPI\b/i.test(oneLine))               result.paymentMode = 'UPI';
    else if (/NEFT|RTGS|IMPS/i.test(oneLine))        result.paymentMode = oneLine.match(/NEFT|RTGS|IMPS/i)[0].toUpperCase();
    else if (/CHALAN|CHALLAN/i.test(oneLine))         result.paymentMode = 'DD / Challan';
    else if (/BY\s*CASH|CASH\s*PAYMENT/i.test(oneLine)) result.paymentMode = 'Cash';
    else if (/TRANSFER/i.test(oneLine))               result.paymentMode = 'Bank Transfer';
    else if (/ONLINE/i.test(oneLine))                 result.paymentMode = 'Online';
  }

  return result;
};

// ─── OCR Run with Timeout ─────────────────────────────────────────────────────
const OCR_TIMEOUT_MS = 30000; // 30s — enough for even slow images

const runOCR = (imagePath) => {
  const recognize = getWorker().then(w => w.recognize(imagePath));
  const timeout   = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('OCR timed out after 30s')), OCR_TIMEOUT_MS)
  );
  return Promise.race([recognize, timeout]);
};

// ─── Internal Helper (reusable by routes & triggers) ─────────────────────────
const processOCRInternal = async (request) => {
  let preprocessedPath = null;
  try {
    const filePath = request.receiptFile?.path;
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error('Receipt file not found on server.');
    }

    // Preprocess image
    preprocessedPath = await preprocessImage(filePath);
    const ocrInputPath = preprocessedPath !== filePath ? preprocessedPath : filePath;

    // Run OCR
    console.log(`▶ OCR started for request ${request._id}`);
    const { data: { text: rawText } } = await runOCR(ocrInputPath);
    console.log(`✅ OCR done — ${rawText.length} chars extracted.`);

    const ocrData = parseOCRFields(rawText || '');
    ocrData.ocrStatus = 'completed';

    request.ocrData = ocrData;
    if (request.overallStatus === 'submitted') request.overallStatus = 'under_review';
    await request.save();

    return { ocrData, rawText };
  } finally {
    // Clean up temp preprocessed file
    if (preprocessedPath && preprocessedPath !== request.receiptFile?.path) {
      try { fs.unlinkSync(preprocessedPath); } catch (_) {}
    }
  }
};

// ─── Route Handler: POST /api/ocr/process/:requestId ─────────────────────────
const processOCR = async (req, res) => {
  try {
    const request = await ClearanceRequest.findById(req.params.requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }
    if (request.student.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const { ocrData, rawText } = await processOCRInternal(request);
    return res.json({ success: true, ocrData, requestId: request._id, rawText });

  } catch (err) {
    console.error('OCR Error:', err.message);
    return res.status(500).json({ success: false, message: 'OCR failed: ' + err.message });
  }
};

// ─── Route Handler: PATCH /api/ocr/confirm/:requestId ────────────────────────
const confirmOCR = async (req, res) => {
  try {
    const request = await ClearanceRequest.findById(req.params.requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }
    if (request.student.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const fields = ['studentName','department','feeCategory','transactionId','amount','paymentDate','receiptNumber','bankName','paymentMode'];
    for (const f of fields) {
      if (req.body[f] !== undefined) request.ocrData[f] = req.body[f];
    }
    request.ocrData.studentConfirmed = true;
    request.ocrData.confirmedAt = new Date();
    await request.save();

    return res.json({ success: true, ocrData: request.ocrData });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { processOCR, confirmOCR, processOCRInternal };

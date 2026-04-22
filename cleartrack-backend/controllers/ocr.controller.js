const path = require('path');
const fs = require('fs');
const os = require('os');
const util = require('util');
const { createWorker } = require('tesseract.js');

const ClearanceRequest = require('../models/ClearanceRequest');

// Try to load sharp — it may not be available on all Node versions
let sharp = null;
try { sharp = require('sharp'); } catch (e) {
  console.warn('⚠️  sharp not available — OCR will run without image preprocessing.');
}

// Aggressive image preprocessing for dot-matrix/thermal receipts
// Returns original path if sharp is unavailable or fails
const runSharpPreprocess = async (inputPath) => {
  if (!sharp) return inputPath;   // graceful no-op
  const cleanedPath = path.join(os.tmpdir(), `cleaned-${Date.now()}.png`);
  try {
    console.log('Running sharp preprocessing...');
    await sharp(inputPath)
      .rotate()                               // auto-rotate EXIF
      .resize({ width: 1600, withoutEnlargement: false }) // 1600px is the sweet spot for OCR speed vs accuracy
      .grayscale()
      .normalise()                            // stretch contrast to full range
      .linear(1.6, -(1.6 * 128 - 128))       // boost midtone contrast
      .sharpen({ sigma: 1.5, m1: 1.5, m2: 3 }) // sharpen edges
      .threshold(160)                         // binarise to pure black/white for OCR
      .png({ compressionLevel: 1 })           // lossless output
      .toFile(cleanedPath);
    console.log('Sharp preprocessing done:', cleanedPath);
    return cleanedPath;
  } catch (err) {
    console.warn('Sharp preprocess failed, using original:', err.message);
    return inputPath;
  }
};



// ─── Helpers ────────────────────────────────────────────────────────────────

// Strip commas/spaces from a number string and return it, or null if invalid
const sanitizeAmount = (str = '') => {
  const clean = str.replace(/[\s,]/g, '');
  const val = parseFloat(clean);
  return isNaN(val) ? null : clean;
};

// Fuzzy-normalise fee category text (handles OCR misreads like TUITLON, ADDMISSION)
const normalizeFeeCategory = (raw = '') => {
  const t = raw.replace(/\b(NEW|THE|AND|OF|FOR|A|AN|FEE|F|EF|LI)\b/gi, ' ')
               .replace(/[^A-Z\s]/gi, ' ')
               .replace(/\s{2,}/g, ' ').trim();
  const up = t.toUpperCase();
  if (/ADMIS/i.test(up))              return 'Admission Fee';
  if (/TUI[TL][LI]?[OQ]N|TUITION/i.test(up)) return 'Tuition Fee';
  if (/HOSTEL/i.test(up))             return 'Hostel Fee';
  if (/BUS|TRANSPORT/i.test(up))      return 'Bus Fee';
  if (/EXAM/i.test(up))               return 'Exam Fee';
  if (/RE.?ADMI/i.test(up))           return 'Re-Admission Fee';
  return t.length > 1 ? t : raw.trim();
};

// Helper: extract the cleanest person-name tokens from a garbled OCR string
// e.g. "DEVIKA kR SG" → "Devika"  |  "Arpitha Dinesh" → "Arpitha Dinesh"
const extractCleanName = (raw = '') => {
  const IGNORE = new Set(['COLLEGE','ENGINEERING','BANK','SERVICE','CO','OP',
    'COOPERATIVE','KADIRUR','CASHIER','OFFICER','REMITTED','TRANSFER',
    'RECEIPT','DEPOSIT','SAVINGS','AUTHORISED','AUTHORIZ']);

  // Keep only tokens that look like name words: start with letter, mostly letters
  const tokens = raw.split(/\s+/).filter(t => {
    if (t.length < 2) return false;
    if (/\d/.test(t)) return false;           // skip tokens with digits
    if (IGNORE.has(t.toUpperCase())) return false;
    const letterRatio = (t.match(/[A-Za-z]/g) || []).length / t.length;
    return letterRatio >= 0.7;                // at least 70% letters
  });

  // Take up to 3 tokens (first name + middle + last at most)
  return tokens.slice(0, 3).map(t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()).join(' ');
};

// ─── Main Parser ─────────────────────────────────────────────────────────────
const parseOCRFields = (rawText) => {
  // Work on the raw text AND a single-line collapsed version for multi-line matches
  const lines  = rawText.split(/\r?\n/);
  const oneLine = rawText.replace(/\r?\n/g, ' ').replace(/\s{2,}/g, ' ');
  const UP     = oneLine.toUpperCase();

  const result = {
    studentName:   '',
    department:    '',
    feeCategory:   '',
    transactionId: '',
    amount:        '',
    paymentDate:   '',
    receiptNumber: '',
    bankName:      '',
    paymentMode:   '',
    rawText
  };

  // ── 1. Receipt Number ──────────────────────────────────────────────────────
  // "No.F 1262", "No.F-1262", "Receipt No 1234", "Chalan / Vr. No 5678"
  for (const p of [
    /No\.?\s*F[\s\-]*(\d{3,6})/i,
    /RECEIPT\s*(?:NO|#)[\s:.]*([A-Z0-9\-]{3,12})/i,
    /CHALAN\s*[\/\\]\s*VR\.?\s*NO[\s:.]*([A-Z0-9\/\-]{3,12})/i,
  ]) {
    const m = oneLine.match(p);
    if (m?.[1]) { result.receiptNumber = m[1].trim(); break; }
  }

  // ── 2. Student Name + Department + Fee Category ────────────────────────────
  // The Particulars section of Kadirur receipts contains lines like:
  //   "By Cash Arpitha Dinesh IT NEW admission FEE"     (cash receipt)
  //   "DEVIKA kR SG"  followed by  "LI TUITLON F"       (transfer receipt, OCR garbled)
  const DEPTS = 'IT|CSE|ME|EE|EC|MCA|MBA|CIVIL|ECE|EEE|BCA|BBA|MTECH|BE';

  // 2a. "By Cash [Name] [Dept] [FeeType]" on one line (cash receipts)
  const byCashRx = new RegExp(`BY\\s+CASH\\s+([A-Z][A-Z.\\s]{2,?})\\s+(${DEPTS})\\b\\s*(.{0,60})`, 'i');
  const cashM    = oneLine.match(byCashRx);
  if (cashM) {
    result.studentName = cashM[1].trim().replace(/\s{2,}/g, ' ');
    result.department  = cashM[2].toUpperCase();
    result.feeCategory = normalizeFeeCategory(cashM[3]);
    result.paymentMode = 'Cash';
  }

  // 2b. Find "Particulars" section block (multi-line on transfer receipts)
  if (!result.studentName) {
    // Find the line index of "Particulars" header
    const partIdx = lines.findIndex(l => /particulars/i.test(l));
    if (partIdx >= 0) {
      // The next 1–5 non-empty lines are the particulars content
      const partLines = lines.slice(partIdx + 1, partIdx + 8)
        .map(l => l.trim()).filter(Boolean);
      const partBlock = partLines.join(' ');

      // Try to find department code in the block
      const deptRx = new RegExp(`\\b(${DEPTS})\\b`, 'i');
      const dM = partBlock.match(deptRx);
      if (dM) {
        result.department = dM[1].toUpperCase();
        // Name = everything before the dept code (first 1-3 proper words)
        const beforeDept = partBlock.slice(0, partBlock.toUpperCase().indexOf(dM[1].toUpperCase())).trim();
        result.studentName = extractCleanName(beforeDept);
        // Fee category = everything after dept code
        const afterDept = partBlock.slice(partBlock.toUpperCase().indexOf(dM[1].toUpperCase()) + dM[1].length).trim();
        result.feeCategory = normalizeFeeCategory(afterDept);
      } else {
        // No dept code found — first line of Particulars is likely the name
        result.studentName = extractCleanName(partLines[0] || '');
        // Remaining lines are fee category
        result.feeCategory = normalizeFeeCategory(partLines.slice(1).join(' '));
      }
    }
  }

  // 2c. Last-resort name: "Customer Name" label
  if (!result.studentName) {
    const cnM = oneLine.match(/CUSTOMER\s*NAME[\s:#]*([A-Z][A-Z.\s]{2,40}?)(?:\s{3,}|$)/i);
    if (cnM?.[1]) {
      const n = cnM[1].replace(/College of Engineering/ig, '').trim();
      const ignores = ['COLLEGE','ENGINEERING','BANK','SERVICE','COOPERATIVE','KADIRUR','CASHIER'];
      if (!ignores.some(w => n.toUpperCase().includes(w))) {
        result.studentName = n.replace(/\d+/g, '').trim();
      }
    }
  }

  // ── 3. Amount ──────────────────────────────────────────────────────────────
  // Strategy: find ALL decimal numbers (xx.xx or x,xxx.xx) in the text,
  // pick the one that looks like a fee (100–300000) and appears on/after Particulars section.
  // Give priority to "Total = xxx" or "otal = xxx" (OCR misread of "Total")

  // 3a. Total= line (handles "otal = 1530. 00" space in decimal)
  const totalM = oneLine.match(/[Tt]otal\s*[=:]\s*([\d,\s]+\.?\s*\d{0,2})/i);
  if (totalM) {
    const clean = sanitizeAmount(totalM[1]);
    const val   = parseFloat(clean);
    if (val >= 100 && val <= 300000) result.amount = '₹' + clean;
  }

  // 3b. Keyword-anchored (RS / AMOUNT / AMT)
  if (!result.amount) {
    const kwM = oneLine.match(/(?:RS\.?|AMT|AMOUNT)\s*:?\s*([\d,.\s]{3,15})/i);
    if (kwM) {
      const clean = sanitizeAmount(kwM[1]);
      if (clean) result.amount = '₹' + clean;
    }
  }

  // 3c. First standalone decimal ≥ 100 (covers "1530.00" alone on a line)
  if (!result.amount) {
    // Match decimal numbers with optional Indian comma grouping
    const decimals = [...oneLine.matchAll(/\b(\d{1,3}(?:[,\s]\d{3})*\.\d{1,2})\b/g)];
    for (const [, raw] of decimals) {
      const clean = sanitizeAmount(raw);
      const val   = parseFloat(clean);
      if (val >= 100 && val <= 300000) { result.amount = '₹' + clean; break; }
    }
  }

  // 3d. Fuzzy: OCR misread chars (L→1, S→5, O→0)
  if (!result.amount) {
    const fuzzy = [...oneLine.matchAll(/[0-9LS]{2,}[.,][0-9LS]{2}/gi)];
    for (const [raw] of fuzzy) {
      const fixed = raw.replace(/L/g,'1').replace(/S/g,'5').replace(/O/g,'0');
      const clean = sanitizeAmount(fixed);
      const val   = parseFloat(clean);
      if (val >= 100 && val <= 300000) { result.amount = '₹' + clean; break; }
    }
  }

  // ── 4. Date ────────────────────────────────────────────────────────────────
  // On Kadirur receipts the date appears BEFORE the "Date:" label, so search all lines
  const datePats = [
    /DATE\s*:?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,     // "Date: 16/12/2025"
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/,                      // "16/12/2025"  (prefer 4-digit year)
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2})/,                      // "16/12/25"
    /(\d{1,2}\s+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\w*\s+\d{2,4})/i,
  ];
  for (const p of datePats) {
    const m = oneLine.match(p);
    if (m?.[1]) { result.paymentDate = m[1].trim(); break; }
  }

  // ── 5. Transaction / Chalan ID ─────────────────────────────────────────────
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

  // ── 6. Bank Name ───────────────────────────────────────────────────────────
  const bankMap = [
    ['KADIRUR SERVICE CO-OP',    'Kadirur Service Co-operative Bank'],
    ['KADIRUR',                  'Kadirur Service Co-operative Bank'],
    ['CO-OPERATIVE',             'Co-operative Bank'],
    ['COOPERATIVE',              'Co-operative Bank'],
    ['KERALA BANK',              'Kerala Bank'],
    ['SOUTH INDIAN',             'South Indian Bank'],
    ['FEDERAL',                  'Federal Bank'],
    ['SBI',                      'State Bank of India'],
    ['HDFC',                     'HDFC Bank'],
    ['ICICI',                    'ICICI Bank'],
    ['AXIS',                     'Axis Bank'],
    ['PNB',                      'Punjab National Bank'],
    ['BOB',                      'Bank of Baroda'],
    ['CANARA',                   'Canara Bank'],
    ['UNION',                    'Union Bank of India'],
    ['KOTAK',                    'Kotak Mahindra Bank'],
  ];
  for (const [kw, name] of bankMap) {
    if (UP.includes(kw)) { result.bankName = name; break; }
  }

  // ── 7. Payment Mode ────────────────────────────────────────────────────────
  if (!result.paymentMode) {
    if      (/\bUPI\b/i.test(oneLine))              result.paymentMode = 'UPI';
    else if (/NEFT|RTGS|IMPS/i.test(oneLine))       result.paymentMode = oneLine.match(/NEFT|RTGS|IMPS/i)[0].toUpperCase();
    else if (/CHALAN|CHALLAN/i.test(oneLine))        result.paymentMode = 'DD / Challan';
    else if (/BY\s*CASH|CASH\s*PAYMENT/i.test(oneLine)) result.paymentMode = 'Cash';
    else if (/TRANSFER/i.test(oneLine))              result.paymentMode = 'Bank Transfer';
    else if (/ONLINE/i.test(oneLine))                result.paymentMode = 'Online';
  }

  return result;
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

    // Step 2: Run tesseract.js with receipt-optimised config
    console.log('Initializing Tesseract worker...');
    const worker = await createWorker('eng', 1, {
      cachePath: path.join(__dirname, '..', 'tessdata'), // Use local folder for persistence
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`OCR Progress: ${Math.round((m.progress || 0) * 100)}%`);
        }
      }
    });
    // PSM 6 = assume a single uniform block of text (best for receipts)
    // OEM 1 = LSTM neural net only (most accurate)
    await worker.setParameters({
      tessedit_pageseg_mode: '6',
      tessedit_ocr_engine_mode: '1',
      preserve_interword_spaces: '1',
    });
    const { data: { text: rawText } } = await worker.recognize(ocrInputPath);
    await worker.terminate();

    if (!rawText || rawText.trim().length === 0) {
      console.warn('⚠️ OCR produced zero text. Check if the image is clear and not too dark.');
    } else {
      console.log(`✅ OCR successful. Extracted ${rawText.length} characters.`);
    }

    const ocrData = parseOCRFields(rawText);
    ocrData.ocrStatus = 'completed';

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

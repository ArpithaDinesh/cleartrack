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
    transactionId: '',
    amount: '',
    paymentDate: '',
    receiptNumber: '',
    bankName: '',
    paymentMode: '',
    rawText
  };

  // 1. Student Name patterns - More robust
  const namePatterns = [
    /(?:NAME|CUSTOMER|STUDENT)[\s:#]*([A-Z.\s]{3,})/i,
    /([A-Z\s]{3,})\s*(?:S[1-8]|S\s*[1-8]|SEM|IV|VI|VIII|II)/i,
    /REMITTED\s+BY\s+([A-Z\s]{3,})/i
  ];
  const ignorePhrases = ['COLLEGE', 'ENGINEERING', 'OFFICER', 'REMITTED', 'BANK', 'SERVICE', 'COOPERATIVE', 'THALASSERY', 'KANNUR', 'KADIRUR', 'TRANSFER', 'RECEIPT', 'CASHIER', 'AUTHORISED'];
  for (const p of namePatterns) {
    const m = rawText.match(p);
    if (m && m[1]) {
      let cleanName = m[1].replace(/College of Engineering/ig, '').trim();
      const isInvalid = ignorePhrases.some(phrase => cleanName.toUpperCase().includes(phrase));
      if (cleanName.length > 2 && !isInvalid) {
        result.studentName = cleanName.replace(/\d+/g, '').trim();
        break;
      }
    }
  }

  // 2. Transaction ID patterns - Optimized for India
  const txnPatterns = [
    /TXN[\s:#]*([A-Z0-9]+)/i,
    /TRANSACTION[\s:#]*ID[\s:]*([A-Z0-9\-]+)/i,
    /REF[\s:#]*([A-Z0-9\-]+)/i,
    /UTR[\s:#]*([A-Z0-9\-]{12,})/i,
    /CHALAN\s*\/\s*VR\.\s*NO[\s:]*([A-Z0-9\/\-]{4,})/i,
    /JOURNAL[\s:]*([A-Z0-9]+)/i,
    /(\d{10,18})/ // Catch long numeric IDs (like UPI/UTR)
  ];
  for (const p of txnPatterns) {
    const m = rawText.match(p);
    if (m) {
      const val = m[1] || m[0];
      if (!/DATE|AMOUNT|RS|INR|BANK|CE/i.test(val) && val.length > 5) {
        result.transactionId = val.replace(/\s/g, '').toUpperCase();
        break;
      }
    }
  }

  // 3. Amount patterns - Handling OCR misreads (S->5, L->1, etc.)
  const amountPattern = /(?:RS|AMT|AMOUNT|TOTAL|NET)[\s:.]*([0-9LS\s,.]{3,10})/i;
  const amtMatch = rawText.match(amountPattern);
  if (amtMatch) {
    let clean = amtMatch[1].replace(/\s/g, '').replace(/L/g, '1').replace(/S/g, '5').replace(/O/g, '0').replace(/[,]/g, '');
    if (!isNaN(parseFloat(clean))) result.amount = '₹' + clean;
  }

  if (!result.amount) {
    const amountMatches = rawText.match(/([0-9LS\s]*[0-9LS]+\s*[\.\/,4]\s*[0-9LS]{2})/ig);
    if (amountMatches) {
      for (let m of amountMatches) {
        let clean = m.replace(/\s/g, '').replace(/L/g, '1').replace(/S/g, '5').replace(/O/g, '0').replace(/4/g, '.').replace(/,/g, '');
        const val = parseFloat(clean);
        if (val > 10 && val < 200000) {
          result.amount = '₹' + clean;
          break;
        }
      }
    }
  }

  // 4. Date patterns
  const datePatterns = [
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/,
    /(\d{1,2}\s+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\w*\s+\d{2,4})/i,
    /DATE[\s:]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i
  ];
  for (const p of datePatterns) {
    const m = rawText.match(p);
    if (m) { result.paymentDate = m[1].trim(); break; }
  }

  // 5. Bank name
  const bankKeywords = ['SBI', 'HDFC', 'ICICI', 'AXIS', 'PNB', 'BOB', 'CANARA', 'UNION', 'KOTAK', 'CO-OPERATIVE', 'COOPERATIVE', 'KADIRUR', 'FEDERAL', 'SOUTH INDIAN', 'KERALA BANK'];
  for (const b of bankKeywords) {
    if (text.includes(b)) { result.bankName = b + ' Bank'; break; }
  }

  // 6. Payment mode
  if (/UPI/i.test(rawText)) result.paymentMode = 'UPI';
  else if (/NEFT|RTGS|IMPS/i.test(rawText)) result.paymentMode = rawText.match(/NEFT|RTGS|IMPS/i)[0];
  else if (/CHALAN|CHALLAN|CHALAN/i.test(rawText)) result.paymentMode = 'DD / Challan';
  else if (/ONLINE|TRANSFER/i.test(rawText)) result.paymentMode = 'Transfer';

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

    const { transactionId, amount, paymentDate, receiptNumber, bankName, paymentMode } = req.body;
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

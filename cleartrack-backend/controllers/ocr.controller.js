const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);
const { createWorker } = require('tesseract.js');

const ClearanceRequest = require('../models/ClearanceRequest');

// Run Python OpenCV preprocessor on the image, returns path to cleaned image
const runOpenCVPreprocess = async (inputPath) => {
  const ext = path.extname(inputPath);
  const cleanedPath = inputPath.replace(ext, '_cleaned' + ext);
  const scriptPath = path.join(__dirname, '..', 'preprocess.py');
  try {
    await execFileAsync('python', [scriptPath, inputPath, cleanedPath]);
    console.log('OpenCV preprocessing done. Using cleaned image.');
    return cleanedPath;
  } catch (err) {
    console.warn('OpenCV preprocess skipped:', err.message);
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

  // Student Name patterns
  const namePatterns = [
    /(?:NAME|CUSTOMER|STUDENT)[\s:#]*([A-Z\s]{3,})/i,
    /([A-Z\s]{3,})\s*(?:S[1-8]|S\s*[1-8]|SEM)/i,
  ];
  const ignorePhrases = ['COLLEGE', 'ENGINEERING', 'OFFICER', 'REMITTED', 'BANK', 'SERVICE', 'COOPERATIVE', 'THALASSERY', 'KANNUR', 'KADIRUR', 'TRANSFER', 'RECEIPT'];
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

  // Transaction ID patterns
  const txnPatterns = [
    /TXN[A-Z0-9]+/i,
    /TRANSACTION[\s:#]*([A-Z0-9\-]+)/i,
    /REF[\s:#]*([A-Z0-9\-]+)/i,
    /UTR[\s:#]*([A-Z0-9\-]+)/i,
    /CHALAN\s*\/\s*VR\.\s*NO[\s:]*([A-Z0-9\/\-]{4,})/i,
    /(\d{10,})/
  ];
  for (const p of txnPatterns) {
    const m = rawText.match(p);
    if (m) {
      const val = m[1] || m[0];
      if (!/DATE|AMOUNT|RS|INR/i.test(val)) {
        result.transactionId = val.replace(/\s/g, '');
        break;
      }
    }
  }

  // Amount patterns
  const amountMatches = rawText.match(/([0-9LS\s]*[0-9LS]+\s*[\.\/,4\s]\s*[0-9LS]{2})/ig);
  if (amountMatches) {
    for (let m of amountMatches) {
      let clean = m.replace(/\s/g, '').replace(/L/g, '1').replace(/S/g, '5').replace(/O/g, '0').replace(/4/g, '.').replace(/,/g, '.');
      const val = parseFloat(clean);
      if (val > 10 && val < 200000) {
        result.amount = '₹' + clean;
        break;
      }
    }
  }

  // Backup: Amount in words
  if (!result.amount) {
    const wordsLine = rawText.match(/(?:Rupees|Words)[^a-z]*([A-Za-z\s]+)(?:Only|Rupees)/i);
    if (wordsLine) {
      const words = wordsLine[1].toLowerCase();
      let total = 0;
      const dict = { 'one':1,'two':2,'three':3,'four':4,'five':5,'six':6,'seven':7,'eight':8,'nine':9,'ten':10,'eleven':11,'twelve':12,'thirteen':13,'fourteen':14,'fifteen':15,'sixteen':16,'seventeen':17,'eighteen':18,'nineteen':19,'twenty':20,'thirty':30,'forty':40,'fifty':50,'sixty':60,'seventy':70,'eighty':80,'ninety':90,'hundred':100,'thousand':1000 };
      const parts = words.split(/\s+/);
      let sub = 0;
      parts.forEach(p => {
        if (dict[p]) {
          if (p === 'thousand') { total += (sub || 1) * 1000; sub = 0; }
          else if (p === 'hundred') { sub = (sub || 1) * 100; }
          else { sub += dict[p]; }
        }
      });
      total += sub;
      if (total > 0) result.amount = '₹' + total + '.00';
    }
  }

  // Date patterns
  const datePatterns = [
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/,
    /(\d{1,2}\s+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\w*\s+\d{2,4})/i,
    /DATE[\s:]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i
  ];
  for (const p of datePatterns) {
    const m = rawText.match(p);
    if (m) { result.paymentDate = m[1].trim(); break; }
  }

  // Receipt number
  const rcptPatterns = [
    /RECEIPT[\s#:]*([A-Z0-9\-]{4,})/i,
    /REC[\s#:]*([A-Z0-9\-]{4,})/i,
    /NO[\s.:]*([A-Z0-9\-]{5,})/i
  ];
  for (const p of rcptPatterns) {
    const m = rawText.match(p);
    if (m && m[1] && !/DATE|AMOUNT/i.test(m[1])) { result.receiptNumber = m[1].trim(); break; }
  }

  // Bank name
  const bankKeywords = ['SBI', 'HDFC', 'ICICI', 'AXIS', 'PNB', 'BOB', 'CANARA', 'UNION', 'KOTAK', 'CO-OPERATIVE', 'COOPERATIVE', 'KADIRUR', 'FEDERAL', 'SOUTH INDIAN'];
  for (const b of bankKeywords) {
    if (text.includes(b)) { result.bankName = b + ' Bank'; break; }
  }

  // Payment mode
  if (/UPI/i.test(rawText)) result.paymentMode = 'UPI';
  else if (/NEFT|RTGS|IMPS/i.test(rawText)) result.paymentMode = rawText.match(/NEFT|RTGS|IMPS/i)[0];
  else if (/CHALAN|CHALLAN/i.test(rawText)) result.paymentMode = 'DD / Challan';
  else if (/ONLINE|NETBANKING/i.test(rawText)) result.paymentMode = 'Online Transfer';
  else if (/CASH|DEPOSIT/i.test(rawText)) result.paymentMode = 'Cash Deposit';

  return result;
};

// @desc  Process OCR on uploaded receipt
// @route POST /api/ocr/process/:requestId
const processOCR = async (req, res) => {
  let preprocessedPath = null;
  try {
    const request = await ClearanceRequest.findById(req.params.requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    if (request.student.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const filePath = request.receiptFile?.path;
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(400).json({ success: false, message: 'Receipt file not found on server.' });
    }

    // Step 1: OpenCV preprocessing (if Python available)
    let ocrInputPath = filePath;
    try {
      preprocessedPath = await runOpenCVPreprocess(filePath);
      ocrInputPath = preprocessedPath;
    } catch (e) {
      console.warn('Skipping OpenCV step:', e.message);
    }

    // Step 2: Run tesseract.js (pure JS — no system install needed)
    console.log('Running tesseract.js OCR on:', ocrInputPath);
    const worker = await createWorker('eng', 1, {
      cachePath: '/tmp',
      logger: m => { if (m.status) console.log('Tesseract:', m.status, Math.round((m.progress||0)*100) + '%'); }
    });
    const { data: { text: rawText } } = await worker.recognize(ocrInputPath);
    await worker.terminate();

    console.log('OCR raw text length:', rawText.length);
    console.log('OCR raw text preview:', rawText.substring(0, 300));

    const ocrData = parseOCRFields(rawText);

    // Step 3: Save to DB
    request.ocrData = ocrData;
    request.overallStatus = request.overallStatus === 'submitted' ? 'under_review' : request.overallStatus;
    await request.save();

    console.log('Parsed OCR data:', ocrData);
    res.json({ success: true, ocrData, requestId: request._id, rawText });

  } catch (err) {
    console.error('OCR Route Error:', err);
    res.status(500).json({ success: false, message: 'OCR processing failed: ' + err.message });
  } finally {
    // Clean up preprocessed image temp file
    if (preprocessedPath && preprocessedPath !== require('./ocr.controller.js') && fs.existsSync(preprocessedPath)) {
      try { fs.unlinkSync(preprocessedPath); } catch(e) {}
    }
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

module.exports = { processOCR, confirmOCR };

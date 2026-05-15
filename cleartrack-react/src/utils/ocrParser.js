/**
 * CLEARTRACK - Frontend OCR Parser
 * Replicates the parsing logic from the backend to process OCR text in the browser.
 */

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
  if (/MESS/i.test(up))                         return 'Mess Fee';
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

export const parseOCRFields = (rawText) => {
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

  // 2a. "By Cash [Name] [Dept] [FeeType]" - Optimized for Kadirur template
  const cashM = oneLine.match(new RegExp(`BY\\s+CASH\\s+([A-Z][A-Z\\.\\s]{2,40}?)(\\s+(${DEPTS}))\\b\\s*(.{0,60})`, 'i'));
  if (cashM) {
    result.studentName = cashM[1].trim().replace(/\s{2,}/g, ' ');
    result.department  = cashM[3].toUpperCase();
    result.feeCategory = normalizeFeeCategory(cashM[4]);
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

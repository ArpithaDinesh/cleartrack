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
    /No\.?F\s*[:.-]?\s*(\d{3,8})/i,
    /No\.?\s*F[\s\-]*(\d{3,8})/i,
    /RECEIPT\s*(?:NO|#)[\s:.]*([A-Z0-9\-]{3,12})/i,
  ]) {
    const m = oneLine.match(p);
    if (m?.[1]) { result.receiptNumber = m[1].trim(); break; }
  }

  // 2. Date
  for (const p of [
    /Date\s*[:.-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/,
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2})/,
  ]) {
    const m = oneLine.match(p);
    if (m?.[1]) { result.paymentDate = m[1].trim(); break; }
  }

  // 3. Amount
  // Look for 4-6 digit numbers with decimals, often isolated or near 'Particulars'/'Amount'
  const amountPatterns = [
    /BY\s+CASH\s+.+?(\d{4,}\.\d{2})/i, // Capture amount on the same line as 'By Cash'
    /Particulars\s*Amount\s*([\d,]{4,}\.\d{2})/i,
    /([\d,]{4,}\.\d{2})\s*Rupees/i,
    /[Tt]otal\s*[=:]\s*([\d,\s]+\.?\s*\d{0,2})/i,
    /(?:RS\.?|AMT|AMOUNT)\s*:?\s*([\d,.\s]{3,15})/i,
  ];
  
  for (const p of amountPatterns) {
    const m = oneLine.match(p);
    if (m?.[1]) {
      const clean = sanitizeAmount(m[1]);
      if (clean && parseFloat(clean) > 100) {
        result.amount = '₹' + clean;
        break;
      }
    }
  }

  // 4. Student Name + Dept + Fee Category
  const DEPTS = 'CSE|IT|EEE|ECE|ME|CE|CIVIL|MCA|MBA|BCA|BBA|MTECH|BE';

  // Specific Kadirur "By Cash" line: "By Cash Arpitha Dinesh IT NEW Admission FEE"
  const kadirurM = oneLine.match(/BY\s+CASH\s+([A-Z\s.]+?)\s+([A-Z]{2,5})\b\s+([A-Z\s]+?)(?:\s+\d{4,}\.\d{2}|Rupees|$)/i);
  if (kadirurM) {
    result.studentName = kadirurM[1].trim().replace(/\s{2,}/g, ' ');
    result.department  = kadirurM[2].toUpperCase();
    result.feeCategory = normalizeFeeCategory(kadirurM[3]);
    result.paymentMode = 'Cash';
  }

  // Fallback for Name if still empty
  if (!result.studentName) {
    const cashM = oneLine.match(new RegExp(`BY\\s+CASH\\s+([A-Z][A-Z\\.\\s]{2,40}?)(\\s+(${DEPTS}))\\b`, 'i'));
    if (cashM) {
      result.studentName = cashM[1].trim().replace(/\s{2,}/g, ' ');
      result.department  = cashM[3].toUpperCase();
      result.paymentMode = 'Cash';
    }
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

  // 8. HEURISTIC FALLBACKS (If fields are still missing)
  // 8a. Heuristic Department
  if (!result.department) {
    const dM = UP.match(new RegExp(`\\b(${DEPTS})\\b`));
    if (dM) result.department = dM[1];
  }

  // 8b. Heuristic Fee Category
  if (!result.feeCategory) {
    if (/ADMIS/i.test(UP)) result.feeCategory = 'Admission Fee';
    else if (/TUI[TL][LI]?[OQ]N/i.test(UP)) result.feeCategory = 'Tuition Fee';
    else if (/HOSTEL/i.test(UP)) result.feeCategory = 'Hostel Fee';
    else if (/BUS|TRANS/i.test(UP)) result.feeCategory = 'Bus Fee';
    else if (/EXAM/i.test(UP)) result.feeCategory = 'Exam Fee';
  }

  // 8c. Heuristic Amount (Largest decimal number)
  if (!result.amount) {
    const allNumbers = [...oneLine.matchAll(/\b(\d{3,}(?:[,\s]\d{3})*(?:\.\d{2})?)\b/g)];
    let maxVal = 0;
    let bestMatch = '';
    for (const [, raw] of allNumbers) {
      const clean = sanitizeAmount(raw);
      const val = parseFloat(clean);
      if (val > maxVal && val < 500000) {
        maxVal = val;
        bestMatch = clean;
      }
    }
    if (bestMatch) result.amount = '₹' + bestMatch;
  }

  // 8d. Heuristic Name (Capitalized words in Particulars area)
  if (!result.studentName) {
    const partIdx = UP.indexOf('PARTICULARS');
    if (partIdx >= 0) {
      const sub = oneLine.slice(partIdx, partIdx + 100);
      result.studentName = extractCleanName(sub.replace(/PARTICULARS/i, ''));
    }
  }

  return result;
};

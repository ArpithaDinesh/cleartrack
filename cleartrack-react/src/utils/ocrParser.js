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
  if (/ADMIS/i.test(up)) return 'Admission Fee';
  if (/TUI[TL][LI]?[OQ]N|TUITION/i.test(up)) return 'Tuition Fee';
  if (/HOSTEL/i.test(up)) return 'Hostel Fee';
  if (/BUS|TRANSPORT/i.test(up)) return 'Bus Fee';
  if (/EXAM/i.test(up)) return 'Exam Fee';
  if (/RE.?ADMI/i.test(up)) return 'Re-Admission Fee';
  if (/MESS/i.test(up)) return 'Mess Fee';
  return t.length > 1 ? t : raw.trim();
};

const IGNORE_WORDS = new Set([
  'COLLEGE', 'ENGINEERING', 'BANK', 'SERVICE', 'CO', 'OP', 'COOPERATIVE',
  'KADIRUR', 'CASHIER', 'OFFICER', 'REMITTED', 'TRANSFER', 'RECEIPT', 'DEPOSIT',
  'SAVINGS', 'AUTHORISED', 'AUTHORIZ', 'PARTICULARS', 'AMOUNT', 'DATE', 'CUSTOMER',
  'CHALAN', 'RUPEES', 'TOTAL', 'WORDS', 'CHALLAN', 'ADMISSION', 'ISO', 'YEAR', 'TEL',
  'OL', 'THE', 'AND', 'BRANCH', 'EXTN', 'KSEB', 'KSCB', 'AC', 'NO', 'TYPE', 'AMOU', 'AMNT',
  'PARTIC', 'PART', 'PARTI', 'AMN', 'AMT', 'CUSTOMER', 'NAME', 'COLLEGE', 'ENGINEERING',
]);

const extractCleanName = (raw = '') => {
  const DEPTS = ['CSE', 'IT', 'EEE', 'ECE', 'ME', 'CE', 'CIVIL'];
  const tokens = raw.split(/[\s,.\-\/]+/).filter(t => {
    const up = t.toUpperCase();
    if (t.length < 2) {
       // Allow single initials (e.g. "M" in SREESHNA M)
       return /^[A-Z]$/.test(t);
    }
    if (/\d/.test(t)) return false; // Contains digits
    if (IGNORE_WORDS.has(up)) return false;
    if (DEPTS.includes(up)) return false;
    if (['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'EVEN', 'ODD'].includes(up)) return false;
    const letterRatio = (t.match(/[A-Za-z]/g) || []).length / t.length;
    return letterRatio >= 0.7;
  });
  return tokens.slice(0, 3)
    .map(t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())
    .join(' ');
};

export const parseOCRFields = (rawText) => {
  // Version indicator
  console.warn('⚡ OCR System Version: 1.2.0 | 🛠️ Mode: Perspective Rectified');
  console.log('📄 RAW OCR TEXT START 📄\n' + rawText + '\n📄 RAW OCR TEXT END 📄');

  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const oneLine = rawText.replace(/\r?\n/g, ' ').replace(/\s{2,}/g, ' ');
  const UP = oneLine.toUpperCase();

  const result = {
    studentName: '', department: '', feeCategory: '',
    transactionId: '', amount: '', paymentDate: '',
    receiptNumber: '', bankName: '', paymentMode: '', rawText,
  };

  const DEPTS = ['CSE','IT','EEE','ECE','ME','CE','CIVIL','MCA','MBA','BCA','BBA','MTECH'];
  const DEPT_REGEX = new RegExp(`\\b(${DEPTS.join('|')})\\b`, 'i');

  // 1. Transaction ID / Ref No (High Priority)
  const TXN_PATTERNS = [
    /(?:TXN|TRANS|REF|UPI|ID)\s*(?:NO|ID)?\s*[:.-]?\s*([A-Z0-9]{8,20})/i,
    /UPI\s*ID\s*[:.-]?\s*([A-Z0-9@.-]{10,})/i,
    /Ref\s*No\.?\s*[:.-]?\s*(\d{10,16})/i,
    /\b([A-Z\d]{12,})\b/ // Long alphanumeric string likely a hash/id
  ];
  for (const p of TXN_PATTERNS) {
    const m = oneLine.match(p);
    if (m?.[1]) {
      // Filter out common false positives
      if (!/UNIVERSITY|COLLEGE|ENGINEERING/i.test(m[1])) {
        result.transactionId = m[1].trim();
        break;
      }
    }
  }

  // 2. Line-by-Line Anchor Search (Name/Dept)
  let deptLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const dM = lines[i].match(DEPT_REGEX);
    if (dM) {
      result.department = dM[1].toUpperCase();
      deptLineIdx = i;
      break;
    }
  }

  if (deptLineIdx !== -1) {
    const currentLine = lines[deptLineIdx];
    const prevLine = deptLineIdx > 0 ? lines[deptLineIdx - 1] : '';
    const nameCandidate = (prevLine.length > 3) ? prevLine : currentLine.split(DEPT_REGEX)[0];
    result.studentName = extractCleanName(nameCandidate);
    const feeCandidate = currentLine + ' ' + (lines[deptLineIdx + 1] || '');
    result.feeCategory = normalizeFeeCategory(feeCandidate);
  }

  // 3. Global Scored Amount Search (Improved)
  const allNumbers = [...oneLine.matchAll(/\b(\d{3,}(?:[,\s]\d{3})*(?:\.\d{2})?)\b/g)];
  let bestScore = -1;
  let bestMatch = '';
  
  for (const [, raw] of allNumbers) {
    const clean = sanitizeAmount(raw);
    const val = parseFloat(clean);
    
    // Ignore common non-amount numbers (years, etc)
    if ([2023, 2024, 2025, 2026, 9001].includes(val)) continue;
    
    let score = val;
    // Decimals are a very strong indicator of currency
    if (raw.includes('.00')) score += 1000000;
    
    // Check for proximity to "Amount", "Total", "Paid"
    const lowerOneLine = oneLine.toLowerCase();
    const idx = oneLine.indexOf(raw);
    const context = lowerOneLine.substring(Math.max(0, idx - 40), idx + raw.length + 20);
    
    if (/(?:total|paid|amount|amt|sum|rs|inr|rupees)/i.test(context)) score += 50000;
    if (/(?:balance|due|remaining)/i.test(context)) score -= 20000; // Penalize balance dues

    if (score > bestScore && val < 500000) {
      bestScore = score;
      bestMatch = clean;
    }
  }
  if (bestMatch) result.amount = '₹' + bestMatch;

  // 4. Improved Date Parsing
  const DATE_PATTERNS = [
    /Date\s*[:.-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/,
    /(\d{1,2}\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*\d{2,4})/i
  ];
  for (const p of DATE_PATTERNS) {
    const m = oneLine.match(p);
    if (m?.[1]) { result.paymentDate = m[1].trim(); break; }
  }

  // 5. Receipt Number
  for (const p of [/No\.?F\s*[:.-]?\s*(\d{3,8})/i, /No\.?\s*F[\s\-]*(\d{3,8})/i, /Receipt\s*No\.?\s*[:.-]?\s*(\d+)/i]) {
    const m = oneLine.match(p);
    if (m?.[1]) { result.receiptNumber = m[1].trim(); break; }
  }

  // Bank Name
  const bankMap = [
    ['KADIRUR', 'Kadirur Service Co-operative Bank'], 
    ['CO-OPERATIVE', 'Co-operative Bank'], 
    ['KERALA BANK', 'Kerala Bank'],
    ['FEDERAL', 'Federal Bank'],
    ['SBI', 'State Bank of India']
  ];
  for (const [kw, name] of bankMap) { if (UP.includes(kw)) { result.bankName = name; break; } }

  // 6. Final Cleanups
  if (!result.studentName) {
    for (const line of lines.slice(0, 10)) {
      const cleaned = extractCleanName(line);
      if (cleaned && cleaned.split(' ').length >= 2) {
        result.studentName = cleaned;
        break;
      }
    }
  }
  
  if (result.studentName) {
    result.studentName = result.studentName.replace(/PARTICULARS|AMOUNT|DATE|CUSTOMER|S[1-8]/gi, '').trim();
  }

  return result;
};


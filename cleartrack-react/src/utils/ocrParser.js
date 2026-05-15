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
    particulars: '',
    amount: '',
    bank: '',
    rawText
  };

  const DEPTS = ['CSE','IT','EEE','ECE','ME','CE','CIVIL','MCA','MBA','BCA','BBA','MTECH'];
  const DEPT_REGEX = new RegExp(`\\b(${DEPTS.join('|')})\\b`, 'i');

  // 1. Line-by-Line Anchor Search (Name/Dept/Particulars)
  let deptLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const dM = lines[i].match(DEPT_REGEX);
    if (dM) {
      deptLineIdx = i;
      break;
    }
  }

  if (deptLineIdx !== -1) {
    const currentLine = lines[deptLineIdx];
    const feeCandidate = currentLine + ' ' + (lines[deptLineIdx + 1] || '');
    result.particulars = normalizeFeeCategory(feeCandidate);
  }

  // 2. Global Scored Amount Search
  const allNumbers = [...oneLine.matchAll(/\b(\d{2,}(?:[,\s]\d{3})*(?:\.\d{2})?)\b/g)];
  let bestScore = -1;
  let bestMatch = '';
  
  for (const [, raw] of allNumbers) {
    const clean = sanitizeAmount(raw);
    const val = parseFloat(clean);
    
    // IGNORE: Years (1900-2099)
    if (val >= 1900 && val <= 2099) continue;
    
    // IGNORE: Common constants or small serial numbers without context
    if (val === 9001 || val === 0) continue;

    let score = 0;
    const idx = oneLine.indexOf(raw);
    const context = oneLine.toLowerCase().substring(Math.max(0, idx - 45), idx + raw.length + 25);
    
    // HIGH PRIORITY: Currency markers
    if (/(?:rs|inr|rupees|₹)/i.test(context)) score += 100000;
    
    // MEDIUM PRIORITY: Total/Paid keywords
    if (/(?:total|paid|amount|amt|sum|received)/i.test(context)) score += 50000;
    
    // QUALITY INDICATOR: Decimals (very common in printed bills)
    if (raw.includes('.00')) score += 20000;
    
    // PENALTY: Words indicating balance or date
    if (/(?:balance|due|remaining|date|year)/i.test(context)) score -= 30000;

    // Use value as a tie-breaker if context is equal
    score += (val / 1000); 

    if (score > bestScore && val < 1000000 && val > 1) {
      bestScore = score;
      bestMatch = clean;
    }
  }
  if (bestMatch) result.amount = '₹' + bestMatch;

  // 3. Bank Name
  const bankMap = [
    ['KADIRUR', 'Kadirur Service Co-operative Bank'], 
    ['CO-OPERATIVE', 'Co-operative Bank'], 
    ['KERALA BANK', 'Kerala Bank'],
    ['FEDERAL', 'Federal Bank'],
    ['SBI', 'State Bank of India'],
    ['HDFC', 'HDFC Bank'],
    ['ICICI', 'ICICI Bank']
  ];
  for (const [kw, name] of bankMap) { if (UP.includes(kw)) { result.bank = name; break; } }

  // 4. Fallback for Particulars if not found via dept
  if (!result.particulars) {
    if (UP.includes('TUITION')) result.particulars = 'Tuition Fee';
    else if (UP.includes('HOSTEL')) result.particulars = 'Hostel Fee';
    else if (UP.includes('BUS') || UP.includes('TRANS')) result.particulars = 'Bus Fee';
    else if (UP.includes('EXAM')) result.particulars = 'Exam Fee';
    else if (UP.includes('SEM')) result.particulars = 'Semester Fee';
    else if (UP.includes('DEV')) result.particulars = 'Development Fee';
    else if (UP.includes('CAUTION')) result.particulars = 'Caution Deposit';
  }

  return result;
};


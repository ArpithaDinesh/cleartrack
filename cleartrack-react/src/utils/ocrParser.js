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
  'BY', 'CASH', 'NEW'
]);

const extractCleanName = (raw = '') => {
  const DEPTS = ['CSE', 'IT', 'EEE', 'ECE', 'ME', 'CE', 'CIVIL', 'MCA', 'MBA'];
  const tokens = raw.split(/[\s,.\-\/]+/).filter(t => {
    const up = t.toUpperCase();
    if (t.length < 2) return /^[A-Z]$/.test(t);
    if (/\d/.test(t)) return false; 
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
  console.warn('⚡ OCR System Version: 1.3.0 | 🛠️ Mode: Smart Field Matching');
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const oneLine = rawText.replace(/\r?\n/g, ' ').replace(/\s{2,}/g, ' ');
  const UP = oneLine.toUpperCase();

  const result = {
    name: '',
    department: '',
    particulars: '',
    amount: '',
    bank: '',
    date: '',
    rawText
  };

  const DEPTS = ['CSE','IT','EEE','ECE','ME','CE','CIVIL','MCA','MBA','BCA','BBA','MTECH'];
  const DEPT_REGEX = new RegExp(`\\b(${DEPTS.join('|')})\\b`, 'i');

  // 1. Extract Date
  const dateMatch = oneLine.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/);
  if (dateMatch) result.date = dateMatch[1];

  // 2. Extract Amount (Priority to patterns like 45720.00)
  const amtMatch = oneLine.match(/\b(\d{3,}\.\d{2})\b/);
  if (amtMatch) {
    result.amount = '₹' + amtMatch[1];
  }

  // 3. Extract Particulars & Anchored Info
  let headerLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const upLine = lines[i].toUpperCase();
    if (upLine.includes('PARTICULAR') && upLine.includes('AMOU')) {
      headerLineIdx = i;
      break;
    }
  }

  if (headerLineIdx !== -1) {
    const tableArea = (lines[headerLineIdx + 1] || '') + ' ' + (lines[headerLineIdx + 2] || '');
    result.particulars = normalizeFeeCategory(tableArea);
    
    // Check if particulars contains name/dept (e.g. "By Cash Arpitha Dinesh IT")
    if (/BY CASH/i.test(tableArea)) {
      const cleanPart = tableArea.replace(/BY CASH/i, '').trim();
      const dM = cleanPart.match(DEPT_REGEX);
      if (dM) result.department = dM[1].toUpperCase();
      result.name = extractCleanName(cleanPart);
    }
  }

  // 4. Fallback Department
  if (!result.department) {
    const dM = oneLine.match(DEPT_REGEX);
    if (dM) result.department = dM[1].toUpperCase();
  }

  // 5. Fallback Name
  if (!result.name) {
    const nameMatch = oneLine.match(/(?:NAME|STUDENT|MR|MS|MRS)[\s:]+([A-Z\s]{3,30})(?:\s|$)/i);
    if (nameMatch) {
      result.name = extractCleanName(nameMatch[1]);
    } else {
      for (let i = 0; i < Math.min(8, lines.length); i++) {
        const up = lines[i].toUpperCase();
        if (lines[i].length > 5 && !IGNORE_WORDS.has(up.split(' ')[0]) && !/KADIRUR|BANK|SERVICE|CO-OP/i.test(up)) {
          result.name = extractCleanName(lines[i]);
          if (result.name) break;
        }
      }
    }
  }

  // 6. Global Amount Scored Search (if not found)
  if (!result.amount) {
    const allNumbers = [...oneLine.matchAll(/\b(\d{2,}(?:[,\s]\d{3})*(?:\.\d{2})?)\b/g)];
    let bestScore = -1;
    let bestMatch = '';
    for (const [, raw] of allNumbers) {
      const clean = sanitizeAmount(raw);
      const val = parseFloat(clean);
      if (val >= 1900 && val <= 2099) continue;
      let score = 0;
      const idx = oneLine.indexOf(raw);
      const context = oneLine.toLowerCase().substring(Math.max(0, idx - 45), idx + raw.length + 25);
      if (/(?:rs|inr|rupees|₹)/i.test(context)) score += 100000;
      if (/(?:total|paid|amount|amt|sum|received)/i.test(context)) score += 50000;
      if (raw.includes('.00')) score += 20000;
      if (score > bestScore && val < 1000000 && val > 1) {
        bestScore = score;
        bestMatch = clean;
      }
    }
    if (bestMatch) result.amount = '₹' + bestMatch;
  }

  // 7. Bank Name
  const bankMap = [
    ['KADIRUR', 'Kadirur Service Co-operative Bank'], 
    ['CO-OPERATIVE', 'Co-operative Bank'], 
    ['KERALA BANK', 'Kerala Bank'],
    ['FEDERAL', 'Federal Bank'],
    ['SBI', 'State Bank of India'],
    ['HDFC', 'HDFC Bank']
  ];
  for (const [kw, name] of bankMap) { if (UP.includes(kw)) { result.bank = name; break; } }

  // 8. Final Particulars normalization
  if (!result.particulars || result.particulars.length < 3) {
    if (UP.includes('TUITION')) result.particulars = 'Tuition Fee';
    else if (UP.includes('HOSTEL')) result.particulars = 'Hostel Fee';
    else if (UP.includes('BUS')) result.particulars = 'Bus Fee';
    else if (UP.includes('ADMISSION')) result.particulars = 'Admission Fee';
  }

  return result;
};


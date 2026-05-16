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
  'PARTIC', 'PART', 'PARTI', 'AMN', 'AMT', 'NAME', 'BY', 'CASH', 'NEW',
  'STUDENT', 'COPY', 'OFFICE', 'ORIGINAL', 'DUPLICATE', 'MEMO', 'VOUCHER', 'SYSTEM', 
  'VERSION', 'REPORT', 'STATEMENT', 'ACCOUNT', 'TIME', 'USER', 'ID', 'REFERENCE', 'SL', 'SR'
]);

const extractCleanName = (raw = '') => {
  const DEPTS = ['CSE', 'IT', 'EEE', 'ECE', 'ME', 'CE', 'CIVIL', 'MCA', 'MBA', 'BCA', 'BBA'];
  const tokens = raw.split(/[\s,.\-\/]+/).filter(t => {
    const up = t.toUpperCase();
    if (t.length < 2) return false; // Ignore single characters (often OCR noise)
    if (/\d/.test(t)) return false; 
    if (IGNORE_WORDS.has(up)) return false;
    // Filter out nonsense strings (no vowels, mostly random letters)
    const vowels = (t.match(/[aeiou]/gi) || []).length;
    if (vowels === 0 && t.length > 3) return false;
    
    // Filter out strings with too many spaces relative to length
    if (t.split(' ').length > 4) return false;

    const letterRatio = (t.match(/[A-Za-z]/g) || []).length / t.length;
    return letterRatio >= 0.7;
  });

  // Names are usually 2-3 words. If we only found 1 word and it's "STUDENT" or "COPY", ignore it.
  if (tokens.length < 2) {
    const up = (tokens[0] || '').toUpperCase();
    if (['STUDENT', 'COPY', 'OFFICE', 'BANK', 'RECEIPT'].includes(up)) return '';
  }

  return tokens.slice(0, 3)
    .map(t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())
    .join(' ');
};

export const parseOCRFields = (rawText, knownStudentName = '', expectedAmount = 0) => {
  console.warn('⚡ OCR System Version: 1.9.0 | 🛠️ Mode: Smart Hint Matching');
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

  // 1. Extract Date & Amount (Quick Match)
  const dateMatch = oneLine.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/);
  if (dateMatch) result.date = dateMatch[1];

  const quickAmt = oneLine.match(/\b(\d{3,}\.\d{2})\b/);
  if (quickAmt) result.amount = '₹' + quickAmt[1];

  // 2. Personalized Name Identification (Highest Priority)
  if (knownStudentName) {
    const searchName = knownStudentName.toUpperCase();
    const nameParts = searchName.split(/\s+/).filter(p => p.length > 2);
    
    // Check for full name match
    if (UP.includes(searchName)) {
      result.name = knownStudentName;
      console.log('🎯 Exact student name match found:', result.name);
    } else {
      // Check for partial match (at least 2 parts of the name)
      let matches = 0;
      for (const part of nameParts) { if (UP.includes(part)) matches++; }
      if (matches >= Math.min(2, nameParts.length)) {
        result.name = knownStudentName;
        console.log('🎯 Partial student name match found:', result.name);
      }
    }
  }

  // 3. Deep Table Extraction (Particulars & Amount)
  let headerLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const upLine = lines[i].toUpperCase();
    if ((upLine.includes('PARTICULAR') || upLine.includes('DESCRIPTION')) && 
        (upLine.includes('AMOU') || upLine.includes('RS') || upLine.includes('AMT'))) {
      headerLineIdx = i;
      break;
    }
  }

  if (headerLineIdx !== -1) {
    const tableItems = [];
    for (let i = headerLineIdx + 1; i < Math.min(headerLineIdx + 6, lines.length); i++) {
      const line = lines[i];
      if (/TOTAL|RUPEES|WORDS|SIGNATURE|CASHIER/i.test(line)) break;
      const part = line.replace(/\b(\d{2,}(?:\.\d{2})?)\b$/, '').trim();
      if (part.length > 3) tableItems.push(normalizeFeeCategory(part));
    }
    if (tableItems.length > 0) result.particulars = tableItems.join(' + ');
  }

  // 4. Fallback Department
  if (!result.department) {
    const dM = oneLine.match(DEPT_REGEX);
    if (dM) result.department = dM[1].toUpperCase();
  }

  // 5. Fallback Name (Avoid headers)
  if (!result.name) {
    const nameMatch = oneLine.match(/(?:NAME|STUDENT|MR|MS|MRS)[\s:]+([A-Z\s]{3,30})(?:\s|$)/i);
    if (nameMatch) {
      result.name = extractCleanName(nameMatch[1]);
      if (result.name) console.log('✅ Name found via regex anchor:', result.name);
    }
    
    if (!result.name) {
      // Look for name in first few lines, but skip common bank/college headers
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        const line = lines[i];
        const up = line.toUpperCase();
        
        // Skip obvious headers
        if (/COLLEGE|ENGINEERING|BANK|SERVICE|CO-OP|KADIRUR|CHALLAN|RECEIPT|CASHIER/i.test(up)) continue;
        if (up.includes('STUDENT COPY') || up.includes('OFFICE COPY')) continue;
        
        const candidate = extractCleanName(line);
        if (candidate && candidate.split(' ').length >= 2) {
          result.name = candidate;
          console.log(`✅ Name found in line ${i}:`, result.name);
          break;
        }
      }
    }
  }

  // 6. Global Scored Search (Robust Fallback)
  if (!result.amount || result.amount.length < 3) {
    const allNumbers = [...oneLine.matchAll(/\b(\d{2,}(?:[,\s]\d{3})*(?:\.\d{2})?)\b/g)];
    let bestScore = -1;
    let bestMatch = '';
    
    for (const [, raw] of allNumbers) {
      const clean = sanitizeAmount(raw);
      const val = parseFloat(clean);
      if (isNaN(val) || val < 1) continue;
      
      // Skip things that look like years or small fees
      if (val >= 1900 && val <= 2100) continue;
      if (val < 50 && !oneLine.toLowerCase().includes('fine')) continue; 

      let score = 0;
      const idx = oneLine.indexOf(raw);
      const context = oneLine.toLowerCase().substring(Math.max(0, idx - 60), idx + raw.length + 30);
      
      // Critical Keywords (High score)
      if (/(?:total|paid|net|grand|received|collected|sum)/i.test(context)) score += 100000;
      if (/(?:rs|inr|rupees|₹)/i.test(context)) score += 50000;
      
      // Formatting hints
      if (raw.includes('.00')) score += 20000;
      if (raw.length >= 4) score += 10000; // Prefer larger numbers for totals
      
      // Negative hints (Penalize things that look like dates or IDs)
      if (/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(context)) score -= 30000; // Nearby date
      if (/(?:date|time|sl|no|id|ref|mob|phone|tel)/i.test(context)) score -= 40000;
      
      // Hint matching (Massive boost if it matches what we expect from the fee structure)
      if (expectedAmount > 0) {
        const diff = Math.abs(val - expectedAmount);
        if (diff < 1) score += 500000; // Perfect match
        else if (diff < (expectedAmount * 0.05)) score += 200000; // Within 5%
      }
      
      if (score > bestScore && val < 2000000) {
        bestScore = score;
        bestMatch = clean;
      }
    }
    
    if (bestMatch) {
      result.amount = '₹' + bestMatch;
      console.log(`💰 Best amount match: ${result.amount} (Score: ${bestScore})`);
    }
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


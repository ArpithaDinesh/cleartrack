const rawText = `THE KADIRUR SERVICE CO-OPERATIVE BANK LTD; No.F-1262
P. O. Kadirur, Thalassery, Kannur Dist, Ph : 0490 2389500
E-mail:kscokadirur@gmail.com | www .kadirurbank.com
AN ISO 9001- 2015 CERTIFIED BANK
Ref. No. KSB/QSF/DA/602
Transfer/Receipt
Ac Type:
Savings Bank Deposit

  

Ac. No:
1100010000394

Customer Name
College of Engineering

16/12/2025 Chalan / Vr. No:
Date:
Particulars Amount

i aS

DEVIKA kR SG
LI TUITLON F
EF

6 |

1530.00

XADIRUR SERVICE CO-OP. BANK LID. +
ENG, COLLEGE EXTN. BRANCH F ,

16 SEC 2025

| TRANSFER

  

otal = 1530. 00
Rupees Gne Thousand Fi is Hfudred ‘Thirty Only

Rupees in words

T |
Remitted by Cashier Authorised Officer
Date OB-07-2025 copies : 500000 1 1()/)9/I095 \d-td-t0

  

  

  

  

  

 `;

const text = rawText.toUpperCase();
const result = { amount: '', date: '', tx: '', receipt: '' };

const txnPatterns = [
  /CHALAN\s*\/\s*VR\.\s*NO[\s:]*([A-Z0-9\-]+)/i, // Look for explicit match
];
for (const p of txnPatterns) {
  const m = rawText.match(p);
  if (m && m[1]) { result.tx = m[1].replace(/\s/g, ''); break; }
}

const amtPatterns = [
  // Often on receipts like this, the amount is just the only standalone decimal number on the right
  /([0-9,]*[0-9]+\s*\.\s*[0-9]{2})/i, // Grabs the first 1530.00 or similar
];

let lastMatch = null;
for (const p of amtPatterns) {
  // Try to find the *first* clean decimal in the text
  const matchArr = rawText.match(new RegExp(p.source, 'ig'));
  if (matchArr && matchArr.length > 0) {
      // Find the first one that isn't a date-like number just in case
      for(let m of matchArr) {
        let clean = m.replace(/\s/g, '');
        if(clean.length >= 4) { // E.g., at least 0.00
            result.amount = clean;
            break;
        }
      }
      if(result.amount) break;
  }
}

console.log(result);

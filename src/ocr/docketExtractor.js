import { validateDocketNumber, isLikelyArtefact } from './numberValidator.js';

// Common labels found on Indian & global logistics dockets / transport receipts
const DOCKET_LABEL_RE = /(?:consignment(?:\s*note)?|docket|dkt|con(?:\.|\b)|c[\.\/]?\s*n\.?|cnote|l[\.\/]?\s*r\.?|g[\.\/]?\s*r\.?|g[\.\/]?\s*c\.?|awb|airway\s*bill|waybill|way\s*bill|tracking|receipt)(?:[\s:\.\-#]*(?:number|num|no|code|#))?[\s:\.\-#]*/i;

// Single word tokens that identify docket labels
const DOCKET_WORD_RE = /^(?:docket|dkt|consignment|cnote|cn|lr|gr|gc|awb|waybill|tracking)$/i;

// Words that should never be treated as docket numbers
const EXCLUDED_WORDS = new Set([
  'CUSTOMER', 'CONSIGNOR', 'CONSIGNEE', 'ORIGINAL', 'DUPLICATE', 'TRIPLICATE',
  'DELIVERY', 'DESTINATION', 'DESCRIPTION', 'PARTICULARS', 'TRANSPORT', 'LOGISTICS',
  'FREIGHT', 'BRANCH', 'SERVICE', 'SERVICES', 'COMPANY', 'LIMITED', 'PRIVATE',
  'INVOICE', 'PACKAGE', 'PACKAGES', 'WEIGHT', 'CHARGES', 'AMOUNT', 'TOTAL',
  'SIGNATURE', 'RECEIVER', 'DRIVER', 'VEHICLE', 'CARRIER', 'STAMP', 'OFFICE', 'STATION',
  'BANGALORE', 'MUMBAI', 'DELHI', 'CHENNAI', 'HYDERABAD', 'KOLKATA', 'PUNE', 'AHMEDABAD'
]);

function isExcludedWord(str) {
  if (!str) return true;
  return EXCLUDED_WORDS.has(str.toUpperCase());
}

/**
 * Extract Consignment Note / Docket number from OCR text and word objects.
 * Works with Baidu PaddleOCR, Gemini AI, and Tesseract.js.
 * @param {string} text  - full OCR text
 * @param {Array}  words - word array (each item has .text, .confidence, .bbox)
 */
export function extractDocketNumber(text = '', words = []) {
  if (!text && words.length === 0) return { value: '', confidence: 'LOW' };

  // ── Strategy 0: Word Proximity (adjacent to or inside label) ───────────────
  if (words.length > 0) {
    const proxResult = extractByWordProximity(words);
    if (proxResult && proxResult.confidence !== 'LOW') {
      return proxResult;
    }
  }

  // ── Strategy 1: Inline regex on full text ──────────────────────────────────
  const INLINE_PATTERNS = [
    /(?:consignment(?:\s*note)?|docket|dkt|c[\.\/]?\s*n\.?|cnote|l[\.\/]?\s*r\.?|g[\.\/]?\s*r\.?|g[\.\/]?\s*c\.?|awb|airway\s*bill|waybill|way\s*bill|tracking|receipt)\s*(?:number|num|no|code|#)?[:\.\-#\s]+([A-Za-z0-9\-]*\d+[A-Za-z0-9\-]*)/i,
    /\b(?:no|num|#)[:\.\-#\s]+([A-Za-z0-9\-]*\d+[A-Za-z0-9\-]*)/i,
  ];

  for (const pattern of INLINE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const candidate = match[1].trim();
      const validated = validateDocketNumber(candidate);
      if (validated.confidence !== 'LOW' && !isLikelyArtefact(validated.value) && !isExcludedWord(validated.value)) {
        return validated;
      }
    }
  }

  // ── Strategy 2: Line-by-Line Inspection ───────────────────────────────────
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    if (DOCKET_LABEL_RE.test(lines[i])) {
      // Check remainder of the same line
      const lineWithoutLabel = lines[i].replace(DOCKET_LABEL_RE, '').trim();
      if (lineWithoutLabel) {
        const valDirect = validateDocketNumber(lineWithoutLabel);
        if (valDirect.confidence !== 'LOW' && !isLikelyArtefact(valDirect.value) && !isExcludedWord(valDirect.value)) {
          return valDirect;
        }
        const tokensSameLine = lineWithoutLabel.split(/[\s,;:]+/).filter(Boolean);
        for (const tok of tokensSameLine) {
          const val = validateDocketNumber(tok);
          if (val.confidence !== 'LOW' && !isLikelyArtefact(val.value) && !isExcludedWord(val.value)) {
            return val;
          }
        }
      }

      // Check next 1-3 lines (in case number is printed right below label)
      for (let j = 1; j <= 3 && i + j < lines.length; j++) {
        const nextLine = lines[i + j];
        if (DOCKET_LABEL_RE.test(nextLine)) continue; // another header
        if (/^(?:date|dt|time|tel|gst|pan|from|to|receiver)\b/i.test(nextLine)) continue; // ignore non-docket fields

        const candidateClean = nextLine.replace(/[\s\-\.\#\:\/]/g, '');
        const valDirect = validateDocketNumber(candidateClean);
        if (valDirect.confidence !== 'LOW' && !isLikelyArtefact(valDirect.value) && !isExcludedWord(valDirect.value)) {
          return valDirect;
        }

        const tokensNextLine = nextLine.split(/[\s,;:]+/).filter(Boolean);
        for (const tok of tokensNextLine) {
          const val = validateDocketNumber(tok);
          if (val.confidence !== 'LOW' && !isLikelyArtefact(val.value) && !isExcludedWord(val.value)) {
            return val;
          }
        }
      }
    }
  }

  // ── Strategy 3: Best Candidate from Word Bounding Boxes ────────────────────
  if (words.length > 0) {
    const validWords = words
      .filter(w => {
        const clean = w.text.replace(/[\s\-\.]/g, '');
        return w.confidence > 40 &&
          /^(?=.*\d)[A-Za-z0-9]{4,22}$/.test(clean) &&
          !isExcludedWord(clean);
      })
      .map(w => {
        const val = validateDocketNumber(w.text);
        const digits = (val.value.match(/\d/g) || []).length;
        return {
          value: val.value,
          confidence: val.confidence,
          ocrConf: w.confidence,
          digits,
          length: val.value.length
        };
      })
      .filter(w => w.confidence !== 'LOW' && !isLikelyArtefact(w.value))
      .sort((a, b) => (b.digits - a.digits) || (b.ocrConf - a.ocrConf));

    if (validWords.length > 0) {
      return { value: validWords[0].value, confidence: validWords[0].confidence };
    }
  }

  // ── Strategy 4: Fallback - Extract Any Prominent Alphanumeric Sequence with Digits
  const allTokens = (text.match(/[A-Za-z0-9\-]{4,22}/g) || [])
    .map(t => t.replace(/[\s\-\.]/g, ''))
    .filter(t => /^(?=.*\d)[A-Za-z0-9]{4,22}$/.test(t) && !isExcludedWord(t));

  const validatedTokens = [];
  for (const token of allTokens) {
    const val = validateDocketNumber(token);
    if (val.confidence !== 'LOW' && !isLikelyArtefact(val.value)) {
      const digits = (val.value.match(/\d/g) || []).length;
      validatedTokens.push({ value: val.value, confidence: val.confidence, digits });
    }
  }

  if (validatedTokens.length > 0) {
    // Pick the token with the highest digit count (docket numbers typically have 6-16 digits)
    validatedTokens.sort((a, b) => b.digits - a.digits);
    return { value: validatedTokens[0].value, confidence: validatedTokens[0].confidence };
  }

  return { value: '', confidence: 'LOW' };
}

// ─── Proximity Helper ────────────────────────────────────────────────────────
function extractByWordProximity(words) {
  // Find label words (e.g. "Docket", "LR", "Consignment", "CN", "AWB")
  const labelWords = words.filter(w => DOCKET_WORD_RE.test(w.text.replace(/[:\.\-#]/g, '')) || DOCKET_LABEL_RE.test(w.text));
  if (labelWords.length === 0) return null;

  // 0a. Check if any label box already contains the number itself (common in PaddleOCR single line items)
  for (const label of labelWords) {
    const inlineMatch = label.text.match(/(?:number|num|no|code|#)?[:\.\-#\s]+([A-Za-z0-9\-]*\d+[A-Za-z0-9\-]*)/i);
    if (inlineMatch) {
      const val = validateDocketNumber(inlineMatch[1]);
      if (val.confidence !== 'LOW' && !isLikelyArtefact(val.value) && !isExcludedWord(val.value)) {
        return val;
      }
    }
  }

  // 0b. Search nearby words (same line or below)
  for (const label of labelWords) {
    const yMid = (label.bbox.y0 + label.bbox.y1) / 2;
    const labelHeight = Math.max(label.bbox.y1 - label.bbox.y0, 20);

    const nearby = words.filter(w => {
      if (w === label) return false;
      const wMid = (w.bbox.y0 + w.bbox.y1) / 2;
      const clean = w.text.replace(/[\s\-\.\#\:\/]/g, '');

      // Check if it's on the same line or line directly below
      const verticalDist = Math.abs(wMid - yMid);
      const isSameLine = verticalDist < Math.max(labelHeight * 1.5, 70) && w.bbox.x0 >= label.bbox.x0 - 20;
      const isBelowLine = (wMid - yMid > 0 && wMid - yMid < Math.max(labelHeight * 4.5, 250)) && Math.abs(w.bbox.x0 - label.bbox.x0) < 350;

      return (
        (isSameLine || isBelowLine) &&
        /^(?=.*\d)[A-Za-z0-9]{4,22}$/.test(clean) &&
        !DOCKET_WORD_RE.test(clean) &&
        !isExcludedWord(clean)
      );
    }).map(w => {
      const val = validateDocketNumber(w.text);
      const dist = Math.hypot(w.bbox.x0 - label.bbox.x1, (w.bbox.y0 + w.bbox.y1)/2 - yMid);
      return { ...val, dist, ocrConf: w.confidence };
    }).filter(w => w.confidence !== 'LOW' && !isLikelyArtefact(w.value))
      .sort((a, b) => a.dist - b.dist); // closest to label first

    if (nearby.length > 0) {
      return { value: nearby[0].value, confidence: nearby[0].confidence };
    }
  }

  return null;
}
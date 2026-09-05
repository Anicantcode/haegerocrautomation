import {
  validateDocketNumber,
  isLikelyArtefact,
  isExplicitPhoneNumber,
  isPotentialMobileNumber,
  isPinCode
} from './numberValidator.js';

// Words that indicate non-docket header/footer lines (phone, tax, address, date)
const NON_DOCKET_LINE_RE = /^(?:phone|ph(?:\.|\b)|tel(?:\.|\b)|telephone|mobile|mob(?:\.|\b)|cell(?:\.|\b)|contact|fax|email|gst|gstin|pan|consignor|consignee|shipper|vehicle|driver|truck|wt|weight|pkgs|packages|qty|amt|amount|date|time|road|pin\s*code|one\s*[:\-])/i;

// Strict word-boundary explicit docket labels (Docket, Dkt, Consignment Note, C-Note, CN, LR, GR, AWB, Tracking)
const DOCKET_EXPLICIT_RE = /\b(?:docket|dkt|consignment(?:\s*note)?|c[\.\/\-]?\s*n(?:ote)?|l[\.\/\-]?\s*r|g[\.\/\-]?\s*r|awb|airway\s*bill|tracking)(?:[\s:\.\-#]*(?:number|num|no|code|#))?\b/i;

// Single word tokens that identify docket label boxes
const DOCKET_WORD_RE = /^(?:docket|dkt|consignment|cnote|cn|lr|gr|awb|waybill|tracking)$/i;

// Words that should never be treated as docket numbers
const EXCLUDED_WORDS = new Set([
  'CUSTOMER', 'CONSIGNOR', 'CONSIGNEE', 'ORIGINAL', 'DUPLICATE', 'TRIPLICATE',
  'DELIVERY', 'DESTINATION', 'DESCRIPTION', 'PARTICULARS', 'TRANSPORT', 'LOGISTICS',
  'FREIGHT', 'BRANCH', 'SERVICE', 'SERVICES', 'COMPANY', 'LIMITED', 'PRIVATE',
  'INVOICE', 'PACKAGE', 'PACKAGES', 'WEIGHT', 'CHARGES', 'AMOUNT', 'TOTAL',
  'SIGNATURE', 'RECEIVER', 'DRIVER', 'VEHICLE', 'CARRIER', 'STAMP', 'OFFICE', 'STATION',
  'BANGALORE', 'MUMBAI', 'DELHI', 'CHENNAI', 'HYDERABAD', 'KOLKATA', 'PUNE', 'AHMEDABAD',
  'MAHARASHTRA', 'SHIPPED', 'BILLED', 'TAXABLE', 'NUMBER', 'DOCKET', 'PHONE', 'MOBILE',
  'BARCODE'
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

  // ── Strategy 0: Word Proximity to explicit Docket label ─────────────────────
  if (words.length > 0) {
    const proxResult = extractByWordProximity(words);
    if (proxResult && proxResult.confidence !== 'LOW') {
      return proxResult;
    }
  }

  // ── Strategy 1: Line-by-Line Inspection (Structured documents & barcodes) ──
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // If line is explicitly a phone/email/tax line, skip
    if (NON_DOCKET_LINE_RE.test(line)) continue;

    if (DOCKET_EXPLICIT_RE.test(line)) {
      // 1a. Check remainder of the same line
      const lineWithoutLabel = line.replace(DOCKET_EXPLICIT_RE, '').replace(/^[:\.\-#\s]+/, '').trim();
      if (lineWithoutLabel) {
        const valDirect = validateDocketNumber(lineWithoutLabel, { allowPotentialMobile: true });
        if (valDirect.confidence !== 'LOW' && !valDirect.isPhone && !isLikelyArtefact(valDirect.value) && !isExcludedWord(valDirect.value)) {
          return valDirect;
        }
        const tokensSameLine = lineWithoutLabel.split(/[\s,;:]+/).filter(Boolean);
        for (const tok of tokensSameLine) {
          const val = validateDocketNumber(tok, { allowPotentialMobile: true });
          if (val.confidence !== 'LOW' && !val.isPhone && !isLikelyArtefact(val.value) && !isExcludedWord(val.value)) {
            return val;
          }
        }
      }

      // 1b. Check next 1-3 lines (in case number is printed right below label e.g. under barcode)
      for (let j = 1; j <= 3 && i + j < lines.length; j++) {
        const nextLine = lines[i + j];
        if (DOCKET_EXPLICIT_RE.test(nextLine)) continue;
        if (NON_DOCKET_LINE_RE.test(nextLine)) break; // Stop if entering another metadata section

        const candidateClean = nextLine.replace(/[\s\-\.\#\:\/]/g, '');
        const valDirect = validateDocketNumber(candidateClean, { allowPotentialMobile: true });
        if (valDirect.confidence !== 'LOW' && !valDirect.isPhone && !isLikelyArtefact(valDirect.value) && !isExcludedWord(valDirect.value)) {
          return valDirect;
        }

        const tokensNextLine = nextLine.split(/[\s,;:]+/).filter(Boolean);
        for (const tok of tokensNextLine) {
          const val = validateDocketNumber(tok, { allowPotentialMobile: true });
          if (val.confidence !== 'LOW' && !val.isPhone && !isLikelyArtefact(val.value) && !isExcludedWord(val.value)) {
            return val;
          }
        }
      }
    }
  }

  // ── Strategy 2: Inline strict regex on full text ───────────────────────────
  const STRICT_INLINE = /\b(?:docket|dkt|consignment(?:\s*note)?|c[\.\/\-]?\s*n(?:ote)?|l[\.\/\-]?\s*r|g[\.\/\-]?\s*r|awb|airway\s*bill|tracking)\s*(?:number|num|no|code|#)?[:\.\-#\s]+([A-Za-z0-9\-]*\d+[A-Za-z0-9\-]*)/i;
  const matchStrict = text.match(STRICT_INLINE);
  if (matchStrict) {
    const val = validateDocketNumber(matchStrict[1].trim(), { allowPotentialMobile: true });
    if (val.confidence !== 'LOW' && !val.isPhone && !isLikelyArtefact(val.value) && !isExcludedWord(val.value)) {
      return val;
    }
  }

  // ── Strategy 3: Best Candidate from Word Bounding Boxes ────────────────────
  if (words.length > 0) {
    const nonDocketBoxes = words.filter(w => NON_DOCKET_LINE_RE.test(w.text));

    const validWords = words
      .filter(w => {
        const clean = w.text.replace(/[\s\-\.\:\/]/g, '');
        if (!/^(?=.*\d)[A-Za-z0-9]{5,22}$/.test(clean)) return false;
        if (isExcludedWord(clean) || isExplicitPhoneNumber(clean) || isPotentialMobileNumber(clean) || isPinCode(clean)) return false;
        if (w.confidence <= 40) return false;

        // Ensure this word is not on the same line as Phone, GST, or Consignor
        for (const nd of nonDocketBoxes) {
          const yDist = Math.abs((w.bbox.y0 + w.bbox.y1)/2 - (nd.bbox.y0 + nd.bbox.y1)/2);
          const xDist = Math.abs(w.bbox.x0 - nd.bbox.x1);
          if (yDist < 50 && xDist < 300) return false;
        }
        return true;
      })
      .map(w => {
        const val = validateDocketNumber(w.text, { allowPotentialMobile: false });
        return {
          value: val.value,
          confidence: val.confidence,
          ocrConf: w.confidence,
          length: val.value.length
        };
      })
      .filter(w => w.confidence !== 'LOW' && !w.isPhone && !isLikelyArtefact(w.value))
      .sort((a, b) => b.ocrConf - a.ocrConf);

    if (validWords.length > 0) {
      return { value: validWords[0].value, confidence: validWords[0].confidence };
    }
  }

  // ── Strategy 4: Fallback to E-Way Bill or Waybill if no Docket Number found ─
  const WAYBILL_RE = /\b(?:e[\-\s]?way\s*bill|way\s*bill|wb)\s*(?:number|num|no|code|#)?[:\.\-#\s]+(\d{10,14})/i;
  const matchWaybill = text.match(WAYBILL_RE);
  if (matchWaybill) {
    const val = validateDocketNumber(matchWaybill[1].trim(), { allowPotentialMobile: true });
    if (val.confidence !== 'LOW' && !val.isPhone) {
      return { ...val, confidence: 'MEDIUM' };
    }
  }

  return { value: '', confidence: 'LOW' };
}

// ─── Proximity Helper ────────────────────────────────────────────────────────
function extractByWordProximity(words) {
  // Find label words (e.g. "Docket Number", "Docket", "Consignment", "LR", "AWB")
  const labelWords = words.filter(w => 
    DOCKET_WORD_RE.test(w.text.replace(/[:\.\-#]/g, '')) || 
    DOCKET_EXPLICIT_RE.test(w.text)
  );
  if (labelWords.length === 0) return null;

  for (const label of labelWords) {
    // 0a. Check if any label box already contains the number itself
    const inlineMatch = label.text.match(/(?:number|num|no|code|#)?[:\.\-#\s]+([A-Za-z0-9\-]*\d+[A-Za-z0-9\-]*)/i);
    if (inlineMatch) {
      const val = validateDocketNumber(inlineMatch[1], { allowPotentialMobile: true });
      if (val.confidence !== 'LOW' && !val.isPhone && !isLikelyArtefact(val.value) && !isExcludedWord(val.value)) {
        return val;
      }
    }

    // 0b. Search nearby words (same line or vertically stacked below, e.g. under barcode)
    const yMid = (label.bbox.y0 + label.bbox.y1) / 2;
    const xCenter = (label.bbox.x0 + label.bbox.x1) / 2;
    const labelHeight = Math.max(label.bbox.y1 - label.bbox.y0, 20);
    const labelWidth = Math.max(label.bbox.x1 - label.bbox.x0, 60);

    const candidates = words.filter(w => {
      if (w === label) return false;
      const clean = w.text.replace(/[\s\-\.\#\:\/]/g, '');
      if (!/^(?=.*\d)[A-Za-z0-9]{5,22}$/.test(clean)) return false;
      if (isExcludedWord(clean) || isExplicitPhoneNumber(clean) || isPinCode(clean)) return false;

      const wMidY = (w.bbox.y0 + w.bbox.y1) / 2;
      const wMidX = (w.bbox.x0 + w.bbox.x1) / 2;
      const verticalDist = wMidY - yMid;

      // Same line (to the right of the label)
      const isSameLine = Math.abs(verticalDist) < Math.max(labelHeight * 1.5, 60) && w.bbox.x0 >= label.bbox.x0 - 20;

      // Vertically below the label (directly below or center aligned, e.g. barcode label)
      // Allow up to 8x label height or 600px for high-res images
      const isBelow = (verticalDist > 0 && verticalDist < Math.max(labelHeight * 8, 600)) &&
                      Math.abs(wMidX - xCenter) < Math.max(labelWidth * 2.2, 450);

      return isSameLine || isBelow;
    }).map(w => {
      const val = validateDocketNumber(w.text, { allowPotentialMobile: true });
      const wMidY = (w.bbox.y0 + w.bbox.y1) / 2;
      const wMidX = (w.bbox.x0 + w.bbox.x1) / 2;
      const dist = Math.hypot(wMidX - xCenter, wMidY - yMid);
      return { ...val, dist, ocrConf: w.confidence };
    }).filter(w => w.confidence !== 'LOW' && !w.isPhone && !isLikelyArtefact(w.value))
      .sort((a, b) => a.dist - b.dist); // closest to label first

    if (candidates.length > 0) {
      return { value: candidates[0].value, confidence: 'HIGH' };
    }
  }

  return null;
}
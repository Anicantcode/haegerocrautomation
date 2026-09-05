import { validateDNNumber, applyOCRCorrections, isLikelyArtefact } from './numberValidator.js';

const DN_LABEL_RE   = /d\.?\s*n\.?\s*no\.?|dn\s*no\.?|delivery\s*note\s*no\.?/i;
const DN_INLINE_RE  = /(?:d\.?\s*n\.?\s*no\.?|dn\s*no\.?|delivery\s*note\s*no\.?)\s*[:\-]?\s*(\d[\d\s]{5,14})/i;

/**
 * Extract DN number using both raw text patterns AND Tesseract word objects.
 * @param {string}  text  - full OCR text
 * @param {Array}   words - Tesseract word array (each has .text, .confidence, .bbox)
 */
export function extractDNNumber(text, words = []) {

  // ── Strategy 0: word-level — high-confidence numeric words near a DN label ──
  if (words.length > 0) {
    const result = extractByWordProximity(words, 'dn');
    if (result && result.confidence !== 'LOW') return result;
  }

  // ── Strategy 1: inline regex on full text ──────────────────────────────────
  const inlineMatch = text.match(DN_INLINE_RE);
  if (inlineMatch) {
    const result = validateDNNumber(inlineMatch[1].trim());
    if (result.confidence !== 'LOW' && !isLikelyArtefact(result.value)) return result;
  }

  // ── Strategy 2: line-by-line ────────────────────────────────────────────────
  const OTHER_LABEL_RE = /^(?:to|t\.o\.|so|s\.o\.|po|p\.o\.|inv|order|ref|bill|item|qty|date)\b/i;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    if (DN_LABEL_RE.test(lines[i])) {
      // Same line
      const m = lines[i].replace(DN_LABEL_RE, '').match(/(\d[\d\s]{5,14})/);
      if (m) {
        const r = validateDNNumber(m[1]);
        if (r.confidence !== 'LOW' && !isLikelyArtefact(r.value)) return r;
      }
      // Next 1-2 lines (only if not another field's label like TO No.)
      for (let j = 1; j <= 2 && i + j < lines.length; j++) {
        if (OTHER_LABEL_RE.test(lines[i + j])) break; // Don't grab TO No!
        const m2 = lines[i + j].match(/(\d[\d\s]{5,14})/);
        if (m2) {
          const r = validateDNNumber(m2[1]);
          if (r.confidence !== 'LOW' && !isLikelyArtefact(r.value)) return r;
        }
      }
    }
  }

  // ── Strategy 3: best high-confidence numeric word (8-12 digits) ────────────
  if (words.length > 0) {
    const nums = words
      .filter(w => w.confidence > 60 && /^\d{8,12}$/.test(w.text.replace(/\s/g, '')))
      .sort((a, b) => b.confidence - a.confidence);
    if (nums.length > 0) {
      const r = validateDNNumber(nums[0].text);
      if (r.confidence !== 'LOW' && !isLikelyArtefact(r.value))
        return { ...r, confidence: 'MEDIUM' };
    }
  }

  // ── Strategy 4: standalone 8-12 digit number anywhere in text ──────────────
  const allNums = (text.match(/\b\d{8,12}\b/g) || []).filter(n => !isLikelyArtefact(n));
  for (const num of allNums) {
    const r = validateDNNumber(num);
    if (r.confidence !== 'LOW') return { ...r, confidence: 'MEDIUM' };
  }

  return { value: '', confidence: 'LOW' };
}

// ─── Helper: find a numeric word whose bounding-box is near a DN-label word ──
function extractByWordProximity(words, labelType) {
  // Find all label words (low confidence is fine — we just need position)
  const labelWords = words.filter(w => DN_LABEL_RE.test(w.text));
  if (labelWords.length === 0) return null;

  for (const label of labelWords) {
    // Look for numeric words on the same or adjacent line (y within ~60px at any scale)
    const yMid = (label.bbox.y0 + label.bbox.y1) / 2;
    const nearby = words.filter(w => {
      const wMid = (w.bbox.y0 + w.bbox.y1) / 2;
      const cleaned = w.text.replace(/\s/g, '');
      return (
        Math.abs(wMid - yMid) < 80 &&
        /^\d{6,14}$/.test(cleaned) &&
        w.bbox.x0 >= label.bbox.x0   // to the right of or below the label
      );
    }).sort((a, b) => a.bbox.x0 - b.bbox.x0);  // left-to-right

    if (nearby.length > 0) {
      const candidate = nearby[0].text.replace(/\s/g, '');
      const r = validateDNNumber(candidate);
      if (r.confidence !== 'LOW' && !isLikelyArtefact(r.value)) return r;
    }
  }
  return null;
}
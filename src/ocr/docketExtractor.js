import { validateDocketNumber, isLikelyArtefact } from './numberValidator.js';

const CONSIGNMENT_LABEL_RE  = /consignment\s*(?:note|no|number|num)\.?|docket\s*(?:number|no|num)\.?|con\.\s*no\.?|cnote|lr\s*no\.?|awb\s*no\.?|waybill/i;
const CONSIGNMENT_INLINE_RE = /(?:consignment\s*(?:note|no|number|num)\.?|docket\s*(?:number|no|num)\.?|lr\s*no\.?|awb\s*no\.?)\s*[:\-]?\s*([A-Za-z0-9\s\-]{5,22})/i;

/**
 * Extract Consignment Note / Docket number using text patterns AND Tesseract word objects.
 * @param {string} text  - full OCR text
 * @param {Array}  words - Tesseract word array
 */
export function extractDocketNumber(text, words = []) {

  // ── Strategy 0: word-level proximity ────────────────────────────────────────
  if (words.length > 0) {
    const result = extractByWordProximity(words);
    if (result && result.confidence !== 'LOW') return result;
  }

  // ── Strategy 1: inline regex ────────────────────────────────────────────────
  const inlineMatch = text.match(CONSIGNMENT_INLINE_RE);
  if (inlineMatch) {
    const r = validateDocketNumber(inlineMatch[1].trim());
    if (r.confidence !== 'LOW' && !isLikelyArtefact(r.value)) return r;
  }

  // ── Strategy 2: line-by-line ────────────────────────────────────────────────
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    if (CONSIGNMENT_LABEL_RE.test(lines[i])) {
      const sameNum = lines[i].replace(CONSIGNMENT_LABEL_RE, '').match(/([A-Za-z0-9\s\-]{5,22})/);
      if (sameNum) {
        const r = validateDocketNumber(sameNum[1]);
        if (r.confidence !== 'LOW' && !isLikelyArtefact(r.value)) return r;
      }
      for (let j = 1; j <= 3 && i + j < lines.length; j++) {
        if (CONSIGNMENT_LABEL_RE.test(lines[i + j])) continue;
        const m = lines[i + j].match(/([A-Za-z0-9\s\-]{5,22})/);
        if (m) {
          const r = validateDocketNumber(m[1]);
          if (r.confidence !== 'LOW' && !isLikelyArtefact(r.value)) return r;
        }
      }
    }
  }

  // ── Strategy 3: best high-confidence long numeric word ──────────────────────
  if (words.length > 0) {
    const nums = words
      .filter(w => w.confidence > 55 && /^[A-Za-z0-9]{6,22}$/.test(w.text.replace(/\s/g, '')))
      .sort((a, b) => b.confidence - a.confidence);
    if (nums.length > 0) {
      const r = validateDocketNumber(nums[0].text.replace(/\s/g, ''));
      if (r.confidence !== 'LOW' && !isLikelyArtefact(r.value))
        return { ...r, confidence: 'MEDIUM' };
    }
  }

  // ── Strategy 4: longest numeric sequence in full text ──────────────────────
  const allNums = (text.match(/[A-Za-z0-9\s\-]{6,22}/g) || [])
    .map(n => n.replace(/\s/g, ''))
    .filter(n => /^[A-Za-z0-9]{6,22}$/.test(n) && !isLikelyArtefact(n));

  if (allNums.length > 0) {
    const best = allNums.sort((a, b) => b.length - a.length)[0];
    const r = validateDocketNumber(best);
    if (r.confidence !== 'LOW') return { ...r, confidence: 'MEDIUM' };
  }

  return { value: '', confidence: 'LOW' };
}

function extractByWordProximity(words) {
  const labelWords = words.filter(w => CONSIGNMENT_LABEL_RE.test(w.text));
  if (labelWords.length === 0) return null;

  for (const label of labelWords) {
    const yMid = (label.bbox.y0 + label.bbox.y1) / 2;
    const nearby = words.filter(w => {
      const wMid = (w.bbox.y0 + w.bbox.y1) / 2;
      const cleaned = w.text.replace(/\s/g, '');
      return (
        Math.abs(wMid - yMid) < 120 &&
        /^\d{12,18}$/.test(cleaned)
      );
    }).sort((a, b) => b.confidence - a.confidence);

    if (nearby.length > 0) {
      const candidate = nearby[0].text.replace(/\s/g, '');
      const r = validateDocketNumber(candidate);
      if (r.confidence !== 'LOW' && !isLikelyArtefact(r.value)) return r;
    }
  }
  return null;
}
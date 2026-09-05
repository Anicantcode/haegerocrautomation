// OCR character corrections applied only for purely numeric fields
const CHAR_CORRECTIONS = { O: '0', o: '0', I: '1', l: '1', S: '5', B: '8', G: '6', Z: '2' };

export function applyOCRCorrections(text) {
  return text.split('').map(c => CHAR_CORRECTIONS[c] ?? c).join('');
}

export function cleanNumeric(text) {
  // Remove spaces, dashes, dots between digits
  return text.replace(/[\s\-\.]/g, '');
}

/**
 * Validate a DN Number (Invoice).
 * Typically 8-12 digits.
 */
export function validateDNNumber(raw) {
  if (!raw) return { value: '', confidence: 'LOW' };
  const corrected = applyOCRCorrections(raw);
  const cleaned = cleanNumeric(corrected);
  if (/^\d{8,12}$/.test(cleaned)) {
    return { value: cleaned, confidence: 'HIGH' };
  }
  if (/^\d{6,15}$/.test(cleaned)) {
    return { value: cleaned, confidence: 'MEDIUM' };
  }
  return { value: cleaned, confidence: 'LOW' };
}

/**
 * Validate a Consignment / Docket Number.
 * Can be 5-22 alphanumeric or numeric characters (e.g. 511874921, 356953700227462, DT5118).
 */
export function validateDocketNumber(raw) {
  if (!raw) return { value: '', confidence: 'LOW' };
  const cleaned = raw.replace(/[\s\-\.]/g, '');
  if (/^[A-Za-z0-9]{6,22}$/.test(cleaned)) {
    return { value: cleaned, confidence: 'HIGH' };
  }
  if (/^[A-Za-z0-9]{4,25}$/.test(cleaned)) {
    return { value: cleaned, confidence: 'MEDIUM' };
  }
  return { value: cleaned, confidence: 'LOW' };
}

/**
 * Check if a number is a likely OCR artefact (all same digit, sequential etc.)
 */
export function isLikelyArtefact(numStr) {
  if (!numStr || numStr.length < 4) return true;
  // All same digit
  if (/^(\d)\1+$/.test(numStr)) return true;
  return false;
}

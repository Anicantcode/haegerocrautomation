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
 * Must contain digits and avoid words, GSTIN, and tax IDs.
 */
export function validateDocketNumber(raw) {
  if (!raw) return { value: '', confidence: 'LOW' };

  // Reject formatted dates e.g. 12/08/2026, 05-09-2026, 2026/09/05
  if (/\b(?:\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/.test(raw)) {
    return { value: '', confidence: 'LOW' };
  }

  const cleaned = raw.replace(/[\s\-\.\#\:\/]/g, '');

  // Must NOT be a pure alphabetic word (like 'CUSTOMER', 'ORIGINAL', 'CONSIGNMENT', 'DELIVERY', 'BANGALORE')
  if (!/\d/.test(cleaned)) {
    return { value: cleaned, confidence: 'LOW' };
  }

  // Must have at least 2 digits to be a legitimate docket/consignment number
  const digitCount = (cleaned.match(/\d/g) || []).length;
  if (digitCount < 2) {
    return { value: cleaned, confidence: 'LOW' };
  }

  // Exclude 8-digit date representations (e.g. 12082026, 20260905)
  if (cleaned.length === 8) {
    const day = parseInt(cleaned.slice(0, 2), 10);
    const month = parseInt(cleaned.slice(2, 4), 10);
    const year = parseInt(cleaned.slice(4, 8), 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2020 && year <= 2035) {
      return { value: cleaned, confidence: 'LOW' };
    }
    const year2 = parseInt(cleaned.slice(0, 4), 10);
    const month2 = parseInt(cleaned.slice(4, 6), 10);
    const day2 = parseInt(cleaned.slice(6, 8), 10);
    if (year2 >= 2020 && year2 <= 2035 && month2 >= 1 && month2 <= 12 && day2 >= 1 && day2 <= 31) {
      return { value: cleaned, confidence: 'LOW' };
    }
  }

  // Exclude Indian GSTIN (15 chars, e.g. 29ABCDE1234F1Z5)
  if (/^\d{2}[A-Za-z]{5}\d{4}[A-Za-z]{1}[A-Za-z\d]{1}Z[A-Za-z\d]{1}$/i.test(cleaned)) {
    return { value: cleaned, confidence: 'LOW' };
  }

  // Exclude PAN card numbers (5 letters, 4 digits, 1 letter)
  if (/^[A-Za-z]{5}\d{4}[A-Za-z]{1}$/i.test(cleaned)) {
    return { value: cleaned, confidence: 'LOW' };
  }

  // High confidence: 5-22 alphanumeric chars with at least 3 digits
  if (/^[A-Za-z0-9]{5,22}$/.test(cleaned) && digitCount >= 3) {
    return { value: cleaned, confidence: 'HIGH' };
  }
  if (/^[A-Za-z0-9]{4,25}$/.test(cleaned) && digitCount >= 2) {
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

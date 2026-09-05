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
 * Check if a number is an unmistakable phone/mobile number (e.g. 12-digit Indian mobile with 91 prefix like 919168651604, or toll-free).
 */
export function isExplicitPhoneNumber(raw) {
  if (!raw) return false;
  const cleaned = raw.replace(/[\s\-\.\(\)\+\:\/]/g, '');
  // 12-digit Indian mobile with country code 91: e.g. 919168651604
  if (/^91[6-9]\d{9}$/.test(cleaned)) return true;
  // 11-digit Indian mobile with leading 0: e.g. 09168651604
  if (/^0[6-9]\d{9}$/.test(cleaned)) return true;
  // Common toll free
  if (/^1800\d{6,7}$/.test(cleaned)) return true;
  return false;
}

/**
 * Check if a 10-digit number looks like a potential Indian mobile number (e.g. 9168651604, 9822012345).
 */
export function isPotentialMobileNumber(raw) {
  if (!raw) return false;
  const cleaned = raw.replace(/[\s\-\.\(\)\+\:\/]/g, '');
  return /^[6-9]\d{9}$/.test(cleaned);
}

/**
 * Check if a 6-digit number is an Indian postal PIN code.
 */
export function isPinCode(raw) {
  if (!raw) return false;
  const cleaned = raw.replace(/[\s\-]/g, '');
  return /^\d{6}$/.test(cleaned);
}

/**
 * Validate a DN Number (Invoice).
 * Typically 8-12 digits.
 */
export function validateDNNumber(raw) {
  if (!raw) return { value: '', confidence: 'LOW' };
  const corrected = applyOCRCorrections(raw);
  const cleaned = cleanNumeric(corrected);

  // Reject phone numbers
  if (isExplicitPhoneNumber(cleaned)) {
    return { value: cleaned, confidence: 'LOW', isPhone: true };
  }

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
 * Can be 5-22 alphanumeric or numeric characters (e.g. 4034715112, 511874921, DT5118).
 * Must contain digits and avoid words, phone numbers, GSTIN, and tax IDs.
 */
export function validateDocketNumber(raw, options = {}) {
  const { allowPotentialMobile = false } = options;
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

  // Must have at least 3 digits to be a legitimate docket/consignment number
  const digitCount = (cleaned.match(/\d/g) || []).length;
  if (digitCount < 3) {
    return { value: cleaned, confidence: 'LOW' };
  }

  // REJECT explicit phone numbers (e.g. 12-digit Indian mobile 919168651604)
  if (isExplicitPhoneNumber(cleaned)) {
    return { value: cleaned, confidence: 'LOW', isPhone: true };
  }

  // If unlabelled candidate, reject potential 10-digit mobile numbers [6-9]xxxxxxxxx
  if (!allowPotentialMobile && isPotentialMobileNumber(cleaned)) {
    return { value: cleaned, confidence: 'LOW', isPhone: true };
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

  // Exclude Indian GSTIN (15 chars, e.g. 27AABCH7896K1ZV)
  if (/^\d{2}[A-Za-z]{5}\d{4}[A-Za-z]{1}[A-Za-z\d]{1}Z[A-Za-z\d]{1}$/i.test(cleaned)) {
    return { value: cleaned, confidence: 'LOW' };
  }

  // Exclude PAN card numbers (5 letters, 4 digits, 1 letter)
  if (/^[A-Za-z]{5}\d{4}[A-Za-z]{1}$/i.test(cleaned)) {
    return { value: cleaned, confidence: 'LOW' };
  }

  // High confidence: 5-20 alphanumeric chars with at least 4 digits
  if (/^[A-Za-z0-9]{5,20}$/.test(cleaned) && digitCount >= 4) {
    return { value: cleaned, confidence: 'HIGH' };
  }
  if (/^[A-Za-z0-9]{4,22}$/.test(cleaned) && digitCount >= 3) {
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

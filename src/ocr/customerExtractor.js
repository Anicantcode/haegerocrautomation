/**
 * Customer Name & Destination City Extractor for Invoices & Delivery Challans.
 */

// Major Indian industrial & commercial logistics cities
const KNOWN_CITIES = [
  'AHMEDABAD', 'AURANGABAD', 'BANGALORE', 'BENGALURU', 'BELGAUM', 'BELAGAVI',
  'BHOPAL', 'CHANDIGARH', 'CHENNAI', 'COIMBATORE', 'DELHI', 'DHARWAD',
  'FARIDABAD', 'GANDHINAGAR', 'GURGAON', 'GURUGRAM', 'HOSUR', 'HUBLI',
  'HYDERABAD', 'INDORE', 'JAIPUR', 'JAMSHEDPUR', 'KANPUR', 'KOLKATA',
  'LUCKNOW', 'LUDHIANA', 'MUMBAI', 'MYSORE', 'MYSURU', 'NAGPUR',
  'NASHIK', 'NAVI MUMBAI', 'NEW DELHI', 'NOIDA', 'PUNE', 'RAJKOT',
  'SURAT', 'THANE', 'VADODARA', 'VISAKHAPATNAM', 'WALUJ', 'CHAKAN',
  'TALEGAON', 'BHOSARI', 'PIMPRI', 'CHINCHWAD', 'PEENYA', 'SRIPERUMBUDUR'
];

const CUSTOMER_LABEL_RE = /\b(?:consignee(?:\s*name)?|buyer(?:\s*name)?|customer(?:\s*name)?|billed\s*to|bill\s*to|shipped\s*to|ship\s*to|m\/s\.?|to\s*[:\-])\b/i;

const SENDER_LABEL_RE = /\b(?:consignor|supplier|seller|dispatched\s*by|from\s*[:\-])\b/i;

const NON_NAME_LINE_RE = /^(?:gst|gstin|pan|cin|tan|inv|invoice|delivery|challan|dn\s*no|date|vehicle|transporter|docket|e[\-\s]?way|phone|tel|email|contact|address|state|pin|code)\b/i;

/**
 * Extracts customer/consignee name and destination city from OCR text.
 * @param {string} text - full OCR document text
 * @returns {{ name: string, city: string }}
 */
export function extractCustomerDetails(text = '') {
  if (!text || typeof text !== 'string') {
    return { name: '', city: '' };
  }

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let name = '';
  let city = '';

  // ── 1. Name Extraction ─────────────────────────────────────────────────────
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip sender/consignor sections
    if (SENDER_LABEL_RE.test(line)) continue;

    if (CUSTOMER_LABEL_RE.test(line)) {
      // 1a. Check same line after label
      let candidate = line.replace(CUSTOMER_LABEL_RE, '').replace(/^[:\.\-#\s]+/, '').trim();

      // Clean up common prefixes like "M/s" or "Messrs"
      candidate = candidate.replace(/^(?:m\/s\.?|to\s*[:\-])\s*/i, '').trim();

      if (isValidNameCandidate(candidate)) {
        name = cleanName(candidate);
        break;
      }

      // 1b. Check next 1-2 lines under the label
      for (let j = 1; j <= 2 && i + j < lines.length; j++) {
        const nextLine = lines[i + j];
        if (NON_NAME_LINE_RE.test(nextLine) || CUSTOMER_LABEL_RE.test(nextLine) || SENDER_LABEL_RE.test(nextLine)) {
          break;
        }
        let nextCandidate = nextLine.replace(/^(?:m\/s\.?|to\s*[:\-])\s*/i, '').trim();
        if (isValidNameCandidate(nextCandidate)) {
          name = cleanName(nextCandidate);
          break;
        }
      }

      if (name) break;
    }
  }

  // Fallback for Name: Look for any standalone "M/s [Company Name]"
  if (!name) {
    const msMatch = text.match(/\bM\/[Ss]\.?\s+([A-Za-z0-9\s\.\,\&\-\(\)]+?)(?:\n|\r|,|GSTIN|PAN|CIN|$)/i);
    if (msMatch && isValidNameCandidate(msMatch[1].trim())) {
      name = cleanName(msMatch[1].trim());
    }
  }

  // ── 2. City Extraction ─────────────────────────────────────────────────────
  // Look for explicit "City: XYZ" or "Destination: XYZ"
  const cityExplicitMatch = text.match(/\b(?:city|dest|destination|place|station)\s*[:\-\.]\s*([A-Za-z\s]{3,25})/i);
  if (cityExplicitMatch) {
    const candCity = cityExplicitMatch[1].trim().toUpperCase();
    if (candCity.length >= 3 && !NON_NAME_LINE_RE.test(candCity)) {
      city = candCity.split(/[\s,]+/)[0];
    }
  }

  // Check known cities list against text
  if (!city) {
    const upperText = text.toUpperCase();
    for (const known of KNOWN_CITIES) {
      const cityRegex = new RegExp(`\\b${known}\\b`);
      if (cityRegex.test(upperText)) {
        city = known;
        break;
      }
    }
  }

  // Fallback: Check city right before 6-digit pin code (e.g. "PUNE - 411014" or "BANGALORE 560058")
  if (!city) {
    const pinMatch = text.match(/([A-Za-z]{3,20})\s*[\-\,]?\s*(?:pin(?:\s*code)?)?\s*[:\-\s]*\b\d{6}\b/i);
    if (pinMatch && !NON_NAME_LINE_RE.test(pinMatch[1])) {
      city = pinMatch[1].trim().toUpperCase();
    }
  }

  return {
    name: name.toUpperCase(),
    city: city.toUpperCase(),
  };
}

function isValidNameCandidate(str) {
  if (!str || str.length < 3) return false;
  if (NON_NAME_LINE_RE.test(str)) return false;
  // Must contain some alphabetic characters and not be purely numbers or dates
  if (!/[A-Za-z]{3,}/.test(str)) return false;
  // Ignore single words like "LIMITED", "PRIVATE", "INDIA"
  if (/^(?:ltd|limited|pvt|private|inc|corp|co|india)$/i.test(str)) return false;
  return true;
}

function cleanName(str) {
  return str
    .replace(/^[:\.\-#\s]+/, '')
    .replace(/[,;]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

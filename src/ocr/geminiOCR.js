/**
 * geminiOCR.js
 * Uses Google Gemini Vision API to extract specific fields from document photos.
 * Much more accurate than on-device Tesseract for real-world document photos.
 */

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ─── Prompts ──────────────────────────────────────────────────────────────────
const PROMPTS = {
  invoice: `You are reading a printed shipping invoice photograph. The document may be rotated in any orientation (horizontal, vertical, 90°, 180°, or 270°).
Your ONLY task: locate the field labeled "DN No.", "DN No", "D.N.No.", or "Delivery Note No." and extract the COMPLETE multi-digit number (typically 8 to 12 digits, e.g. 2131537328).

CRITICAL INSTRUCTIONS:
1. Rotation: If the text is oriented sideways or vertically, read it in the correct orientation.
2. Full Number: The DN number is a long sequence (typically 8-12 digits). Extract ALL digits in the sequence. Never truncate or return only the first few digits (e.g., do NOT return "213" if the number is "2131537328").
3. Spacing: If digits have small spaces between groups (e.g. "213 153 7328"), combine them all into one continuous number.
4. Field Exclusion: Do NOT return the "TO No.", "Transport Order No.", "SO No.", "PO No.", or other numbers printed below or near it.
5. Format: Return ONLY the digits, nothing else. No labels, no spaces, no punctuation.
6. If not found, return: NOT_FOUND

Example:
Document text:
DN No. 2131537328
TO No. 8000192992
Output: 2131537328`,

  docket: `You are reading a printed shipping docket / consignment note / waybill photograph. The document may be rotated at any angle.
Your ONLY task: find the Docket Number / Consignment Note Number / LR Number / AWB Number / Waybill Number.
It is typically printed near, above, or below a barcode or at the top of the document labeled "Docket Number", "Docket No.", "Consignment Note No.", "LR No.", etc.

CRITICAL INSTRUCTIONS:
1. Extract the COMPLETE full docket number (digits and any prefix letters if part of the code, e.g. 4034715112 or DT5118).
2. Extract ALL characters/digits across the entire sequence. Never truncate.
3. Return ONLY the number/code. No labels, no formatting spaces, no punctuation.
4. If not found, return: NOT_FOUND

Example:
Document text:
Docket Number
4034715112
Output: 4034715112`,
};

// ─── Main function ────────────────────────────────────────────────────────────
/**
 * @param {string} imageDataUrl  JPEG/PNG data URL of the captured image
 * @param {'invoice'|'docket'} mode
 * @param {string} apiKey        Gemini API key
 * @returns {{ value: string, confidence: 'HIGH'|'MEDIUM'|'LOW', raw: string }}
 */
export async function extractWithGemini(imageDataUrl, mode, apiKey) {
  if (!apiKey) throw new Error('No Gemini API key configured.');

  // Strip data URL prefix → pure base64
  const [header, base64Data] = imageDataUrl.split(',');
  const mimeType = header.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg';

  const body = {
    contents: [{
      parts: [
        { text: PROMPTS[mode] },
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data,
          },
        },
      ],
    }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 64,
    },
  };

  // Candidate models in order of speed and accuracy
  const models = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
    'gemini-2.5-pro',
    'gemini-1.5-pro',
  ];
  let lastError = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson?.error?.message ?? `HTTP ${res.status}: ${res.statusText}`;
        // If it's a 404 Not Found on the model, continue to next candidate model
        if (res.status === 404 || msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('is not supported')) {
          continue;
        }
        throw new Error(msg);
      }

      const json = await res.json();
      const raw  = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

      if (!raw || raw.toUpperCase() === 'NOT_FOUND') {
        return { value: '', confidence: 'LOW', raw };
      }

      // Clean — remove label prefixes if returned
      let cleaned = raw.replace(/^(?:docket\s*(?:number|no|num)?|consignment\s*(?:note|no|num)?|lr\s*no|awb\s*no|cnote)[\s:\-\.#]*/i, '').trim();
      cleaned = cleaned.replace(/[\s\-_]/g, '');

      if (!cleaned || cleaned.toUpperCase() === 'NOT_FOUND') return { value: '', confidence: 'LOW', raw };

      const isHighConf = mode === 'invoice'
        ? /^\d{6,14}$/.test(cleaned)
        : /^[A-Za-z0-9]{5,22}$/.test(cleaned);

      return {
        value:      cleaned,
        confidence: isHighConf ? 'HIGH' : 'MEDIUM',
        raw,
      };
    } catch (err) {
      lastError = err;
      console.warn(`Gemini model ${model} attempt failed:`, err.message);
      if (err.message.includes('API_KEY_INVALID') || err.message.includes('API key not valid')) {
        throw new Error('Invalid Gemini API key. Please check your key at aistudio.google.com.');
      }
    }
  }

  throw lastError || new Error('Gemini API call failed.');
}

/**
 * Validate an API key by querying the models endpoint
 */
export async function testGeminiApiKey(apiKey) {
  if (!apiKey || !apiKey.trim()) throw new Error('Please enter an API key.');
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`;
  const res = await fetch(url);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `API error ${res.status}`);
  }
  const data = await res.json();
  if (!data.models || data.models.length === 0) {
    throw new Error('No models accessible with this API key.');
  }
  return true;
}

// ─── API key persistence ──────────────────────────────────────────────────────
const KEY_STORAGE = 'ids_gemini_api_key';

export function saveApiKey(key)  { localStorage.setItem(KEY_STORAGE, key.trim()); }
export function loadApiKey()     { return localStorage.getItem(KEY_STORAGE) ?? ''; }
export function clearApiKey()    { localStorage.removeItem(KEY_STORAGE); }
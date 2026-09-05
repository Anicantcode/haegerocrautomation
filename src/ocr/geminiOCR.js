/**
 * geminiOCR.js
 * Uses Google Gemini Vision API to extract specific fields from document photos.
 * Much more accurate than on-device Tesseract for real-world document photos.
 */

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ─── Prompts ──────────────────────────────────────────────────────────────────
const PROMPTS = {
  invoice: `You are an expert OCR vision system analyzing a printed shipping document/invoice.
Your task: Find the Delivery Note Number (DN No.).
Look for the text labeled "DN No.", "DN No", "D.N. No.", or "Delivery Note".
The DN Number is the numeric sequence printed next to or below that label (for example: 2134197996).
Ignore "TO No." (Transport Order) which may be printed nearby.

Output valid JSON with the exact key "dnNumber":
{
  "dnNumber": "2134197996"
}
If no DN number is present, return {"dnNumber": ""}.`,

  docket: `You are an expert OCR vision system analyzing a printed shipping docket / consignment note.
Your task: Find the Docket Number / Consignment Note Number / LR Number.
Look for "Docket Number", "Docket No.", "Consignment No.", or the code printed near/under the barcode (for example: 4034715112).

Output valid JSON with the exact key "docketNumber":
{
  "docketNumber": "4034715112"
}
If no Docket number is present, return {"docketNumber": ""}.`,
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
      maxOutputTokens: 128,
      responseMimeType: 'application/json',
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
        if (res.status === 404 || msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('is not supported')) {
          continue;
        }
        throw new Error(msg);
      }

      const json = await res.json();
      const raw  = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

      // ── Layer 1: Structured JSON parsing ─────────────────────────────────
      let extracted = '';
      try {
        const cleanJson = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
        const parsed = JSON.parse(cleanJson);
        extracted = mode === 'invoice'
          ? (parsed.dnNumber || parsed.dn_number || parsed.dn || parsed.number || '')
          : (parsed.docketNumber || parsed.docket_number || parsed.docket || parsed.number || '');
      } catch (_) {
        // Look for JSON object in text
        const jsonMatch = raw.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            extracted = mode === 'invoice'
              ? (parsed.dnNumber || parsed.dn_number || parsed.number || '')
              : (parsed.docketNumber || parsed.docket_number || parsed.number || '');
          } catch (_) {}
        }
      }

      // ── Layer 2: Regex extraction fallback on raw response ───────────────
      if (!extracted) {
        if (mode === 'invoice') {
          // Look for 8-12 digits in raw text
          const m = raw.match(/DN[\s\w.:\-]*?(\d{8,12})/i) || raw.match(/\b(\d{8,12})\b/);
          if (m) extracted = m[1];
        } else {
          const m = raw.match(/(?:Docket|Consignment)[\s\w.:\-]*?([A-Za-z0-9]{6,20})/i) || raw.match(/\b([A-Za-z0-9]{6,20})\b/);
          if (m) extracted = m[1];
        }
      }

      // Clean digits/characters
      const cleaned = mode === 'invoice'
        ? String(extracted).replace(/\D/g, '')
        : String(extracted).replace(/[^A-Za-z0-9]/g, '');

      if (!cleaned) {
        return { value: '', confidence: 'LOW', raw };
      }

      const isHighConf = mode === 'invoice'
        ? /^\d{8,12}$/.test(cleaned)
        : /^[A-Za-z0-9]{6,22}$/.test(cleaned);

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
import { validateDocketNumber, validateDNNumber } from './numberValidator.js';

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

  docket: `You are an expert OCR vision system analyzing a printed logistics shipping docket, lorry receipt (LR), or consignment note.
Your task: Extract the Docket Number / Consignment Note Number / LR Number / Waybill Number.
Look for labels like:
- "Docket No.", "Docket Number", "Dkt No."
- "LR No.", "L.R. No.", "Lorry Receipt No."
- "Consignment No.", "Consignment Note No.", "C/N No."
- "GR No.", "G.R. No.", "GC No."
- "AWB No.", "Airway Bill No.", "Waybill No."
- Or the large prominent barcode number printed on the document (e.g. 4034715112 or DT5118).
Do not extract phone numbers, dates, or GSTINs.

Output valid JSON with the exact key "docketNumber":
{
  "docketNumber": "4034715112"
}
If no Docket number is found, return {"docketNumber": ""}.`,
};

// Cached discovered models for current session
let discoveredModels = null;

async function getSupportedModels(apiKey) {
  if (discoveredModels && discoveredModels.length > 0) {
    return discoveredModels;
  }

  const PREFERRED_ORDER = [
    'gemini-3.1-flash-image',
    'gemini-3.1-flash-lite-image',
    'gemini-3.6-flash',
    'gemini-3.1-flash',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-2.0-flash-lite',
  ];

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const available = (data.models || [])
        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
        .map(m => m.name.replace(/^models\//, ''));

      const sorted = [];
      for (const pref of PREFERRED_ORDER) {
        if (available.includes(pref)) sorted.push(pref);
      }
      for (const av of available) {
        if (!sorted.includes(av) && (av.includes('flash') || av.includes('image'))) {
          sorted.push(av);
        }
      }

      if (sorted.length > 0) {
        discoveredModels = sorted;
        console.log('Gemini active models found:', discoveredModels);
        return discoveredModels;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch /models list, using preferred list:', err.message);
  }

  return PREFERRED_ORDER;
}

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
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
    },
  };

  const models = await getSupportedModels(apiKey);
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
      const parts = json?.candidates?.[0]?.content?.parts || [];
      
      // Grab text, ignoring thought parts if present
      const jsonPart = parts.find(p => !p.thought && p.text && p.text.includes('{'))
                    || parts.find(p => !p.thought && p.text)
                    || parts[parts.length - 1];
      const raw = jsonPart?.text?.trim() ?? '';
      const allText = parts.map(p => p.text || '').join('\n');

      // ── Layer 1: Structured JSON parsing ─────────────────────────────────
      let extracted = '';
      try {
        const cleanJson = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
        const parsed = JSON.parse(cleanJson);
        if (mode === 'invoice') {
          extracted = parsed.dnNumber || parsed.dn_number || parsed.dn || parsed.deliveryNoteNumber || parsed.number || '';
        } else {
          extracted = parsed.docketNumber || parsed.docket_number || parsed.docket || parsed.docketNo || parsed.docket_no ||
            parsed.lrNumber || parsed.lr_number || parsed.lrNo || parsed.lr_no ||
            parsed.consignmentNumber || parsed.consignment_number || parsed.consignmentNo || parsed.consignment_no ||
            parsed.consignmentNoteNumber || parsed.consignment_note_number ||
            parsed.waybill || parsed.waybillNumber || parsed.awb || parsed.awbNumber || parsed.trackingNumber || parsed.tracking_number || parsed.number || '';

          if (!extracted && typeof parsed === 'object') {
            for (const v of Object.values(parsed)) {
              if (typeof v === 'string' || typeof v === 'number') {
                const val = validateDocketNumber(String(v).trim());
                if (val.confidence !== 'LOW') {
                  extracted = val.value;
                  break;
                }
              }
            }
          }
        }
      } catch (_) {
        // Look for JSON object in text
        const jsonMatch = raw.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (mode === 'invoice') {
              extracted = parsed.dnNumber || parsed.dn_number || parsed.number || '';
            } else {
              extracted = parsed.docketNumber || parsed.docket_number || parsed.docket || parsed.docketNo || parsed.docket_no ||
                parsed.lrNumber || parsed.lrNo || parsed.consignmentNumber || parsed.consignment_no || parsed.waybill || parsed.awb || parsed.number || '';
              if (!extracted && typeof parsed === 'object') {
                for (const v of Object.values(parsed)) {
                  if (typeof v === 'string' || typeof v === 'number') {
                    const val = validateDocketNumber(String(v).trim());
                    if (val.confidence !== 'LOW') {
                      extracted = val.value;
                      break;
                    }
                  }
                }
              }
            }
          } catch (_) {}
        }
      }

      // ── Layer 2: Regex extraction fallback on all response text ─────────
      if (!extracted) {
        const targetText = raw.length > 5 ? raw : allText;
        if (mode === 'invoice') {
          // Look for DN No. followed by digits or any 8-12 digit sequence
          const m = targetText.match(/DN[\s\w.:\-]*?(\d{8,12})/i) || targetText.match(/\b(\d{8,12})\b/);
          if (m) extracted = m[1];
        } else {
          const m = targetText.match(/(?:Docket|Consignment|LR|L\.R\.|GR|GC|Waybill|AWB)[\s\w.:\-#]*?([A-Za-z0-9\-]{4,22})/i)
            || targetText.match(/\b([A-Za-z0-9\-]*\d{2,}[A-Za-z0-9\-]*)\b/);
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

      const validation = mode === 'invoice'
        ? validateDNNumber(cleaned)
        : validateDocketNumber(cleaned, { allowPotentialMobile: true });

      if (validation.isPhone || validation.confidence === 'LOW') {
        return { value: '', confidence: 'LOW', raw };
      }

      return {
        value:      validation.value,
        confidence: validation.confidence,
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
  const models = await getSupportedModels(apiKey);
  if (!models || models.length === 0) {
    throw new Error('No models accessible with this API key.');
  }
  return true;
}

// ─── API key persistence ──────────────────────────────────────────────────────
const KEY_STORAGE = 'ids_gemini_api_key';

export function saveApiKey(key)  { localStorage.setItem(KEY_STORAGE, key.trim()); }
export function loadApiKey()     { return localStorage.getItem(KEY_STORAGE) ?? ''; }
export function clearApiKey()    { localStorage.removeItem(KEY_STORAGE); }
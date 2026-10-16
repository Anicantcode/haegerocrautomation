// Extractor for Material codes and Bin locations in Inventory module

const MATERIAL_LABEL_RE = /\b(?:mat(?:erial)?|part(?:\s*no)?|item(?:\s*no|\s*code)?|sku|product(?:\s*code)?)(?:[\s:\.\-#]*(?:no|num|code|#))?\b/i;
const BIN_LABEL_RE      = /\b(?:bin|rack|shelf|loc(?:ation)?|slot)(?:[\s:\.\-#]*(?:no|num|code|#))?\b/i;

const COMMON_WORDS = new Set([
  'MATERIAL', 'PART', 'ITEM', 'BIN', 'LOCATION', 'RACK', 'SHELF', 'DATE', 'QTY', 'QUANTITY',
  'YEAR', 'REMARK', 'HAEGER', 'INDIA', 'TOTAL', 'NAME', 'DESCRIPTION', 'STATUS', 'BATCH', 'LOT'
]);

export function extractInventoryCode(text = '', words = [], type = 'material') {
  if (!text && words.length === 0) return { value: '', confidence: 'LOW' };

  const isMaterial = type === 'material';
  const labelRe = isMaterial ? MATERIAL_LABEL_RE : BIN_LABEL_RE;

  // 1. Try finding by label proximity in words
  if (words.length > 0) {
    const labelIdx = words.findIndex(w => labelRe.test(w.text));
    if (labelIdx >= 0) {
      for (let j = 1; j <= 3 && labelIdx + j < words.length; j++) {
        const candidate = words[labelIdx + j].text.replace(/[\:\#]/g, '').trim();
        if (candidate.length >= 2 && !COMMON_WORDS.has(candidate.toUpperCase())) {
          return { value: candidate, confidence: 'HIGH' };
        }
      }
    }
  }

  // 2. Line-by-line regex search
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (labelRe.test(line)) {
      const stripped = line.replace(labelRe, '').replace(/[\:\#\-\.]/g, ' ').trim();
      const parts = stripped.split(/\s+/).filter(p => p.length >= 2 && !COMMON_WORDS.has(p.toUpperCase()));
      if (parts.length > 0) {
        return { value: parts[0], confidence: 'HIGH' };
      }
      // Check next line
      if (i + 1 < lines.length) {
        const nextParts = lines[i + 1].split(/\s+/).filter(p => p.length >= 2 && !COMMON_WORDS.has(p.toUpperCase()));
        if (nextParts.length > 0) {
          return { value: nextParts[0], confidence: 'MEDIUM' };
        }
      }
    }
  }

  // 3. Fallback: pick the best candidate word
  if (words.length > 0) {
    const validWords = words
      .map(w => ({ text: w.text.trim(), conf: w.confidence || 0 }))
      .filter(w => w.text.length >= 3 && /^[A-Za-z0-9\-_]+$/.test(w.text) && !COMMON_WORDS.has(w.text.toUpperCase()))
      .sort((a, b) => b.conf - a.conf);

    if (validWords.length > 0) {
      return { value: validWords[0].text, confidence: 'MEDIUM' };
    }
  }

  // 4. Fallback from lines
  for (const line of lines) {
    const tokens = line.split(/\s+/).filter(t => t.length >= 3 && /^[A-Za-z0-9\-_]+$/.test(t) && !COMMON_WORDS.has(t.toUpperCase()));
    if (tokens.length > 0) {
      return { value: tokens[0], confidence: 'LOW' };
    }
  }

  return { value: '', confidence: 'LOW' };
}

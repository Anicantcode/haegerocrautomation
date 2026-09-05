/**
 * High-performance hybrid barcode scanner for logistics documents.
 * 1. Uses native hardware-accelerated BarcodeDetector if supported by browser/device.
 * 2. Seamlessly falls back to ZXing MultiFormat reader for universal browser support (iOS Safari, Firefox, etc.).
 */

let zxingReader = null;

async function getZXingReader() {
  if (zxingReader) return zxingReader;
  try {
    const { BrowserMultiFormatReader } = await import('@zxing/browser');
    zxingReader = new BrowserMultiFormatReader();
    return zxingReader;
  } catch (err) {
    console.warn('Failed to load @zxing/browser, trying @zxing/library fallback:', err);
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/library');
      zxingReader = new BrowserMultiFormatReader();
      return zxingReader;
    } catch (e2) {
      console.error('All ZXing loaders failed:', e2);
      return null;
    }
  }
}

/**
 * Scan a video, canvas, image element, or image data URL for 1D or 2D barcodes.
 * @param {HTMLVideoElement|HTMLCanvasElement|HTMLImageElement|ImageBitmap|string} input
 * @returns {Promise<{ value: string, format: string, source: string }|null>}
 */
export async function scanBarcode(input) {
  if (!input) return null;

  let source = input;
  if (typeof input === 'string') {
    source = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = input;
    });
    if (!source) return null;
  }

  // ── 1. Fast Native BarcodeDetector (Chrome Android, Edge, Chromium) ─────────
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const detector = new window.BarcodeDetector({
        formats: [
          'code_128',
          'code_39',
          'code_93',
          'ean_13',
          'ean_8',
          'itf',
          'qr_code',
          'upc_a',
          'upc_e',
          'codabar',
          'data_matrix'
        ]
      });
      const barcodes = await detector.detect(source);
      if (barcodes && barcodes.length > 0) {
        for (const b of barcodes) {
          const raw = (b.rawValue || '').trim();
          if (raw) {
            return {
              value: raw,
              format: b.format ? b.format.replace(/_/g, ' ').toUpperCase() : 'BARCODE',
              source: 'native'
            };
          }
        }
      }
    } catch (nativeErr) {
      // Not supported format or frame issue; continue to ZXing fallback
    }
  }

  // ── 2. Universal ZXing MultiFormat Fallback ────────────────────────────────
  try {
    const reader = await getZXingReader();
    if (reader) {
      let result = null;
      if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) {
        result = await reader.decodeFromCanvas(source);
      } else if (typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement) {
        result = await reader.decodeFromVideoElement(source);
      } else if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
        result = await reader.decodeFromImageElement(source);
      }

      if (result && result.getText()) {
        const text = result.getText().trim();
        const fmt = result.getBarcodeFormat ? String(result.getBarcodeFormat()) : 'BARCODE';
        return {
          value: text,
          format: fmt,
          source: 'zxing'
        };
      }
    }
  } catch (zxingErr) {
    // Normal when no barcode is present in the current frame
  }

  return null;
}

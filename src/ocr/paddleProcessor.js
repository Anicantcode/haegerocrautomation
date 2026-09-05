import * as ort from 'onnxruntime-web';

let paddleService = null;
let initPromise = null;

// Configure ONNX Runtime environment
try {
  if (typeof window !== 'undefined') {
    const isIsolated = typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated;
    ort.env.wasm.numThreads = isIsolated ? Math.min(navigator.hardwareConcurrency || 2, 4) : 1;
    ort.env.wasm.proxy = false;
  }
} catch (e) {
  console.warn('Could not tune ONNX runtime env:', e);
}

/**
 * Converts data URL, image, or canvas into an HTMLCanvasElement
 */
async function toCanvas(input) {
  if (typeof HTMLCanvasElement !== 'undefined' && input instanceof HTMLCanvasElement) {
    return input;
  }
  if (typeof OffscreenCanvas !== 'undefined' && input instanceof OffscreenCanvas) {
    return input;
  }
  if (typeof ImageBitmap !== 'undefined' && input instanceof ImageBitmap) {
    const canvas = document.createElement('canvas');
    canvas.width = input.width;
    canvas.height = input.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(input, 0, 0);
    return canvas;
  }
  if (typeof input === 'string') {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas);
      };
      img.onerror = () => reject(new Error('Failed to load image for PaddleOCR'));
      img.src = input;
    });
  }
  throw new Error('Unsupported image input format for PaddleOCR');
}

export async function initPaddleOCR(onProgress) {
  if (paddleService && paddleService.isInitialized?.()) return paddleService;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      onProgress?.('Loading Baidu PaddleOCR v4 neural models (~6MB)...');
      const { PaddleOcrService } = await import('ppu-paddle-ocr/web');
      const service = new PaddleOcrService();
      await service.initialize();
      paddleService = service;
      return service;
    } catch (err) {
      console.error('Failed to initialize PaddleOCR:', err);
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
}

export async function recognizeWithPaddle(canvasOrDataUrl, onProgress) {
  const service = await initPaddleOCR(onProgress);

  onProgress?.('Preparing image for Baidu PP-OCR...');
  const canvas = await toCanvas(canvasOrDataUrl);

  onProgress?.('Running PaddleOCR detection & recognition...');
  const result = await service.recognize(canvas);

  // Flatten lines for extractors
  const words = [];
  const lines = result.lines || [];
  for (const line of lines) {
    const lineItems = Array.isArray(line) ? line : [line];
    for (const item of lineItems) {
      if (!item || !item.text) continue;
      const b = item.box || {};
      let x0 = 0, y0 = 0, x1 = 0, y1 = 0;

      if (Array.isArray(b) && b.length > 0) {
        const xs = b.map(p => (Array.isArray(p) ? p[0] : (p?.x ?? 0)));
        const ys = b.map(p => (Array.isArray(p) ? p[1] : (p?.y ?? 0)));
        x0 = Math.min(...xs);
        x1 = Math.max(...xs);
        y0 = Math.min(...ys);
        y1 = Math.max(...ys);
      } else if (typeof b.x === 'number') {
        x0 = b.x;
        y0 = b.y;
        x1 = b.x + (b.width || 0);
        y1 = b.y + (b.height || 0);
      }

      words.push({
        text: String(item.text).trim(),
        confidence: Math.round((item.confidence || 0) * 100),
        bbox: { x0, y0, x1, y1 },
      });
    }
  }

  // Fallback if result.results was populated instead of lines
  if (words.length === 0 && Array.isArray(result.results)) {
    for (const item of result.results) {
      if (!item || !item.text) continue;
      const b = item.box || {};
      let x0 = 0, y0 = 0, x1 = 0, y1 = 0;
      if (Array.isArray(b) && b.length > 0) {
        const xs = b.map(p => (Array.isArray(p) ? p[0] : (p?.x ?? 0)));
        const ys = b.map(p => (Array.isArray(p) ? p[1] : (p?.y ?? 0)));
        x0 = Math.min(...xs);
        x1 = Math.max(...xs);
        y0 = Math.min(...ys);
        y1 = Math.max(...ys);
      } else if (typeof b.x === 'number') {
        x0 = b.x;
        y0 = b.y;
        x1 = b.x + (b.width || 0);
        y1 = b.y + (b.height || 0);
      }
      words.push({
        text: String(item.text).trim(),
        confidence: Math.round((item.confidence || 0) * 100),
        bbox: { x0, y0, x1, y1 },
      });
    }
  }

  // If bounding boxes didn't yield words but text exists, split into words
  if (words.length === 0 && result.text) {
    const tokens = result.text.split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      words.push({
        text: token,
        confidence: Math.round((result.confidence || 0) * 100) || 80,
        bbox: { x0: 0, y0: 0, x1: 0, y1: 0 }
      });
    }
  }

  return {
    text: result.text || '',
    confidence: Math.round((result.confidence || 0) * 100),
    words,
  };
}

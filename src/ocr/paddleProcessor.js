let paddleService = null;
let initPromise = null;

export async function initPaddleOCR(onProgress) {
  if (paddleService && paddleService.isInitialized?.()) return paddleService;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      onProgress?.('Loading Baidu PaddleOCR v4 models...');
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

  let input = canvasOrDataUrl;
  if (typeof canvasOrDataUrl === 'string' && canvasOrDataUrl.startsWith('data:')) {
    const base64 = canvasOrDataUrl.split(',')[1];
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    input = bytes.buffer;
  }

  onProgress?.('Running PaddleOCR detection...');
  const result = await service.recognize(input);

  // Flatten lines for extractors
  const words = [];
  if (result.lines) {
    for (const line of result.lines) {
      for (const item of line) {
        if (item.text) {
          words.push({
            text: item.text,
            confidence: Math.round((item.confidence || 0) * 100),
            bbox: item.box ? {
              x0: Math.min(...item.box.map(p => p.x)),
              x1: Math.max(...item.box.map(p => p.x)),
              y0: Math.min(...item.box.map(p => p.y)),
              y1: Math.max(...item.box.map(p => p.y)),
            } : { x0: 0, x1: 0, y0: 0, y1: 0 }
          });
        }
      }
    }
  }

  return {
    text: result.text || '',
    confidence: Math.round((result.confidence || 0) * 100),
    words,
  };
}

import { useRef, useState, useCallback } from 'react';

// ─── Otsu binarisation ────────────────────────────────────────────────────────
function otsuThreshold(data) {
  const hist = new Array(256).fill(0);
  const total = data.length / 4;
  for (let i = 0; i < data.length; i += 4) hist[data[i]]++;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, maxVar = 0, threshold = 128;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) ** 2;
    if (v > maxVar) { maxVar = v; threshold = i; }
  }
  return threshold;
}

function applyContrastEnhancement(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  let min = 255, max = 0;
  // Convert to grayscale & find dynamic range
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2]);
    d[i] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  // Adaptive contrast stretching (preserves fonts, dot matrix, and eliminates washed-out text)
  const range = (max - min) || 1;
  for (let i = 0; i < d.length; i += 4) {
    const g = d[i];
    const stretched = Math.min(255, Math.max(0, Math.round(((g - min) / range) * 255)));
    d[i] = d[i+1] = d[i+2] = stretched;
    d[i+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

export function useCamera() {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [error,   setError]   = useState(null);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width:  { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().then(() => setIsReady(true)).catch(() => {});
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(() => {});
          setIsReady(true);
        };
      }
    } catch (err) {
      if (err.name === 'NotAllowedError')
        setError('Camera permission denied. Please allow camera access and reload.');
      else if (err.name === 'NotFoundError')
        setError('No camera found on this device.');
      else
        setError(`Camera error: ${err.message}`);
    }
  }, []);

  const ensureVideo = useCallback(() => {
    if (videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().then(() => setIsReady(true)).catch(() => {});
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsReady(false);
  }, []);

  /**
   * Capture current frame.
   * Returns { previewUrl, processedCanvas }
   *   previewUrl      – JPEG data URL for display to the user (original colours)
   *   processedCanvas – upscaled + binarised canvas ready for Tesseract
   */
  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !isReady || video.readyState < 2) return null;

    const W = video.videoWidth;
    const H = video.videoHeight;

    // ── 1. Raw capture (for display) ─────────────────────────────────────────
    const raw = document.createElement('canvas');
    raw.width = W; raw.height = H;
    raw.getContext('2d').drawImage(video, 0, 0, W, H);
    const previewUrl = raw.toDataURL('image/jpeg', 0.96);

    // ── 2. Processed copy: contrast-enhanced canvas for local OCR (Paddle / Tesseract) ──
    const SCALE = Math.min(1.5, 2048 / Math.max(W, H));
    const proc = document.createElement('canvas');
    proc.width  = Math.round(W * SCALE);
    proc.height = Math.round(H * SCALE);
    const ctx = proc.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(video, 0, 0, proc.width, proc.height);
    applyContrastEnhancement(ctx, proc.width, proc.height);

    return { previewUrl, processedCanvas: proc };
  }, [isReady]);

  return { videoRef, isReady, error, startCamera, stopCamera, captureFrame, ensureVideo };
}
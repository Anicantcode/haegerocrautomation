import { useState, useEffect, useRef } from 'react';
import { useCamera } from '../hooks/useCamera.js';
import { scanBarcode } from '../ocr/barcodeScanner.js';
import { recognizeWithPaddle } from '../ocr/paddleProcessor.js';
import { initOCR, recognizeImage } from '../ocr/ocrProcessor.js';
import { extractDNNumber } from '../ocr/invoiceExtractor.js';
import { extractInventoryCode } from '../ocr/inventoryExtractor.js';

function playBeep() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine'; osc.frequency.value = 940;
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.28);
  } catch (_) {}
}

function vibrate() {
  try { navigator.vibrate?.(150); } catch (_) {}
}

export function ScanDNModal({
  isOpen,
  onClose,
  onDNScanned,
  onScanned,
  mode = 'dn',
  title = '',
}) {
  const { videoRef, isReady, error: camError, startCamera, stopCamera, captureFrame } = useCamera();
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const isMaterial = mode === 'material';
  const defaultTitle = isMaterial ? 'Scan Material' : 'Scan Delivery Note (DN)';
  const displayTitle = title || defaultTitle;
  const initialStatus = isMaterial
    ? 'Point camera at material barcode or label'
    : 'Point camera at DN barcode or invoice';

  const [statusMsg, setStatusMsg] = useState(initialStatus);
  const scanningBarcodeRef = useRef(false);

  const handleResult = (val) => {
    if (onScanned) onScanned(val);
    else if (onDNScanned) onDNScanned(val);
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
      setStatusMsg(initialStatus);
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, initialStatus]); // eslint-disable-line

  // Real-time automatic barcode scanning loop
  useEffect(() => {
    if (!isOpen || !isReady || camError || isProcessingOcr) return;

    let active = true;
    const interval = setInterval(async () => {
      if (!active || scanningBarcodeRef.current) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      scanningBarcodeRef.current = true;
      try {
        const found = await scanBarcode(video);
        if (found && found.value && active) {
          const rawCandidate = isMaterial
            ? found.value.trim()
            : found.value.replace(/[\s\-\.\#\:\/]/g, '');

          if (rawCandidate.length >= 2) {
            playBeep();
            vibrate();
            handleResult(rawCandidate);
            onClose();
          }
        }
      } catch (_) {
        // ignore frame decode err
      } finally {
        scanningBarcodeRef.current = false;
      }
    }, 280);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isOpen, isReady, camError, isProcessingOcr, isMaterial, onClose, videoRef]);

  // Fallback: OCR capture if barcode is missing or not scanning
  const handleOcrCapture = async () => {
    if (isProcessingOcr) return;
    setIsProcessingOcr(true);
    setStatusMsg(`Running OCR to extract ${isMaterial ? 'Material code' : 'DN number'}...`);

    try {
      const frame = captureFrame();
      if (!frame?.dataUrl) {
        setStatusMsg('Could not capture camera frame.');
        setIsProcessingOcr(false);
        return;
      }

      let extractedCode = null;

      // Try PaddleOCR first
      try {
        const paddleRes = await recognizeWithPaddle(frame.dataUrl);
        if (paddleRes?.lines) {
          const fullText = paddleRes.lines.map(l => l.text).join('\n');
          if (isMaterial) {
            const ext = extractInventoryCode(fullText, [], 'material');
            if (ext?.value) extractedCode = ext.value;
          } else {
            const ext = extractDNNumber(fullText, []);
            if (ext?.value) extractedCode = ext.value;
          }
        }
      } catch (_) {}

      // Fallback to Tesseract if paddle did not extract
      if (!extractedCode) {
        await initOCR();
        const tesseractRes = await recognizeImage(frame.dataUrl);
        if (tesseractRes?.text) {
          if (isMaterial) {
            const ext = extractInventoryCode(tesseractRes.text, tesseractRes.words || [], 'material');
            if (ext?.value) extractedCode = ext.value;
          } else {
            const ext = extractDNNumber(tesseractRes.text, tesseractRes.words || []);
            if (ext?.value) extractedCode = ext.value;
          }
        }
      }

      if (extractedCode) {
        playBeep();
        vibrate();
        handleResult(extractedCode);
        onClose();
      } else {
        setStatusMsg(`❌ Could not detect ${isMaterial ? 'Material Code' : 'DN Number'}. Try getting closer or enter manually.`);
      }
    } catch (err) {
      setStatusMsg(`❌ OCR error: ${err.message}`);
    } finally {
      setIsProcessingOcr(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">📷</span>
            <h3 className="text-white font-bold text-base">{displayTitle}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl p-1 leading-none"
          >
            ✕
          </button>
        </div>

        {/* Camera Viewport */}
        <div className="relative aspect-[4/3] bg-black overflow-hidden flex items-center justify-center">
          {camError ? (
            <div className="text-red-400 text-sm text-center p-4">
              <p>Camera Error: {camError}</p>
              <p className="text-xs text-gray-500 mt-1">Please ensure camera permissions are allowed.</p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Aiming Reticle */}
              <div className="absolute inset-8 border-2 border-blue-500/80 rounded-xl pointer-events-none flex items-center justify-center shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                <div className="w-full h-0.5 bg-blue-400/80 animate-laser-scan shadow-[0_0_8px_#38bdf8]" />
              </div>
            </>
          )}
        </div>

        {/* Status & Actions */}
        <div className="p-4 flex flex-col gap-3">
          <p className="text-gray-300 text-xs text-center font-medium">
            {statusMsg}
          </p>

          <div className="flex gap-2">
            <button
              onClick={handleOcrCapture}
              disabled={isProcessingOcr || !isReady}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white font-semibold py-2.5 px-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow"
            >
              <span>{isProcessingOcr ? '⏳ Reading...' : '📸 Capture & OCR'}</span>
            </button>
            <button
              onClick={onClose}
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

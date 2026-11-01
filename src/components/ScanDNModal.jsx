import { useState, useEffect, useRef } from 'react';
import { useCamera } from '../hooks/useCamera.js';
import { scanBarcode } from '../ocr/barcodeScanner.js';
import { recognizeWithPaddle } from '../ocr/paddleProcessor.js';
import { initOCR, recognizeImage } from '../ocr/ocrProcessor.js';
import { extractDNNumber } from '../ocr/invoiceExtractor.js';
import { extractInventoryCode } from '../ocr/inventoryExtractor.js';
import { extractCustomerDetails } from '../ocr/customerExtractor.js';

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
  const isInvoice = mode === 'invoice';
  const isName = mode === 'name';

  let defaultTitle = 'Scan Delivery Note (DN)';
  let initialStatus = 'Point camera at DN barcode or invoice';

  if (isMaterial) {
    defaultTitle = 'Scan Material';
    initialStatus = 'Point camera at material barcode or label';
  } else if (isInvoice) {
    defaultTitle = 'Scan Invoice (DN, Name, City)';
    initialStatus = 'Point camera at invoice or delivery challan';
  } else if (isName) {
    defaultTitle = 'Scan Customer Name';
    initialStatus = 'Point camera at customer or consignee name';
  }

  const displayTitle = title || defaultTitle;
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
          if (isInvoice) {
            const rawCandidate = found.value.replace(/[\s\-\.\#\:\/]/g, '');
            if (rawCandidate.length >= 2) {
              playBeep();
              vibrate();
              handleResult({ dnNumber: rawCandidate, name: '', city: '' });
              onClose();
            }
          } else {
            const rawCandidate = isMaterial || isName
              ? found.value.trim()
              : found.value.replace(/[\s\-\.\#\:\/]/g, '');

            if (rawCandidate.length >= 2) {
              playBeep();
              vibrate();
              handleResult(rawCandidate);
              onClose();
            }
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
  }, [isOpen, isReady, camError, isProcessingOcr, isMaterial, isInvoice, isName, onClose, videoRef]);

  // Fallback: OCR capture if barcode is missing or not scanning
  const handleOcrCapture = async () => {
    if (isProcessingOcr) return;
    setIsProcessingOcr(true);
    setStatusMsg(`Running OCR to extract ${isInvoice ? 'Invoice details' : isName ? 'Customer Name' : isMaterial ? 'Material code' : 'DN number'}...`);

    try {
      const frame = captureFrame();
      if (!frame?.dataUrl) {
        setStatusMsg('Could not capture camera frame.');
        setIsProcessingOcr(false);
        return;
      }

      let extractedResult = null;

      // Helper to process full OCR text according to mode
      const processOcrText = (fullText, words = []) => {
        if (isInvoice) {
          const dnExt = extractDNNumber(fullText, words);
          const custExt = extractCustomerDetails(fullText);
          if (dnExt?.value || custExt?.name) {
            return {
              dnNumber: dnExt?.value || '',
              name: custExt?.name || '',
              city: custExt?.city || '',
            };
          }
          return null;
        }

        if (isName) {
          const custExt = extractCustomerDetails(fullText);
          return custExt?.name || null;
        }

        if (isMaterial) {
          const ext = extractInventoryCode(fullText, words, 'material');
          return ext?.value || null;
        }

        const ext = extractDNNumber(fullText, words);
        return ext?.value || null;
      };

      // Try PaddleOCR first
      try {
        const paddleRes = await recognizeWithPaddle(frame.dataUrl);
        if (paddleRes?.lines) {
          const fullText = paddleRes.lines.map(l => l.text).join('\n');
          extractedResult = processOcrText(fullText, []);
        }
      } catch (_) {}

      // Fallback to Tesseract if paddle did not extract
      if (!extractedResult) {
        await initOCR();
        const tesseractRes = await recognizeImage(frame.dataUrl);
        if (tesseractRes?.text) {
          extractedResult = processOcrText(tesseractRes.text, tesseractRes.words || []);
        }
      }

      if (extractedResult) {
        playBeep();
        vibrate();
        handleResult(extractedResult);
        onClose();
      } else {
        const fieldName = isInvoice ? 'Invoice details' : isName ? 'Customer Name' : isMaterial ? 'Material Code' : 'DN Number';
        setStatusMsg(`❌ Could not detect ${fieldName}. Try getting closer or enter manually.`);
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

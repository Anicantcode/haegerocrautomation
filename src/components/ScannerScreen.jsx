import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp, ACTIONS, isDuplicateDN, isDuplicateDocket } from '../context/AppContext.jsx';
import { useCamera } from '../hooks/useCamera.js';
import { extractWithGemini, loadApiKey } from '../ocr/geminiOCR.js';
import { recognizeWithPaddle } from '../ocr/paddleProcessor.js';
import { initOCR, recognizeImage } from '../ocr/ocrProcessor.js';
import { extractDNNumber } from '../ocr/invoiceExtractor.js';
import { extractDocketNumber } from '../ocr/docketExtractor.js';
import { scanBarcode } from '../ocr/barcodeScanner.js';
import { ManualEntryDialog } from './ManualEntryDialog.jsx';
import { ApiKeyModal } from './ApiKeyModal.jsx';

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
function vibrate() { try { navigator.vibrate?.(150); } catch (_) {} }

const PHASE = { PREVIEW: 'preview', PROCESSING: 'processing', OK: 'ok', NONE: 'none' };

export function ScannerScreen({ mode, onBack }) {
  const { state, dispatch } = useApp();
  const { videoRef, isReady, error: camError, startCamera, stopCamera, captureFrame, ensureVideo } = useCamera();

  const [phase,         setPhase]         = useState(PHASE.PREVIEW);
  const [previewUrl,    setPreviewUrl]     = useState(null);
  const [ocrResult,     setOcrResult]      = useState(null);
  const [ocrEngine,     setOcrEngine]      = useState('');   // 'gemini' | 'paddle' | 'tesseract'
  const [engineChoice,  setEngineChoice]   = useState(() => localStorage.getItem('haeger_ocr_engine') || 'auto');
  const [lastOcrError,  setLastOcrError]   = useState('');
  const [processingMsg, setProcessingMsg]  = useState('');
  const [editValue,     setEditValue]      = useState(null);
  const [showManual,    setShowManual]     = useState(false);
  const [showApiKey,    setShowApiKey]     = useState(false);
  const [apiKey,        setApiKey]         = useState(loadApiKey);
  const [savedBanner,   setSavedBanner]    = useState('');
  const [dupWarning,    setDupWarning]     = useState('');
  const [activeMode,    setActiveMode]    = useState(mode);
  const [isCapturing,   setIsCapturing]   = useState(false);
  const [autoBarcode,   setAutoBarcode]    = useState(() => localStorage.getItem('haeger_auto_barcode') !== 'false');
  const scanningBarcodeRef = useRef(false);
  const lastScannedBarcodeRef = useRef('');
  const barcodeCooldownRef = useRef(0);

  const isInvoice  = activeMode === 'invoice';
  const modeLabel  = isInvoice ? 'Invoice' : 'Docket';
  const fieldLabel = isInvoice ? 'DN No.'  : 'Docket / Consignment No.';

  useEffect(() => { startCamera(); return () => stopCamera(); }, []); // eslint-disable-line

  // ── Real-Time Camera Barcode Auto-Detection (Instant Barcode Scan) ───────────
  useEffect(() => {
    if (phase !== PHASE.PREVIEW || !isReady || !autoBarcode || camError) return;
    let active = true;

    const interval = setInterval(async () => {
      if (!active || scanningBarcodeRef.current) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      scanningBarcodeRef.current = true;
      try {
        const found = await scanBarcode(video);
        if (found && found.value && active) {
          const rawCandidate = found.value.replace(/[\s\-\.\#\:\/]/g, '');
          if (rawCandidate.length >= 4) {
            // Prevent immediate re-scan of the same code during cooldown
            if (rawCandidate === lastScannedBarcodeRef.current && Date.now() < barcodeCooldownRef.current) {
              return;
            }

            // Check for duplicates ONLY for Invoice (DN No). Docket numbers CAN be duplicate!
            const isDup = activeMode === 'invoice' && isDuplicateDN(rawCandidate, state.records);

            if (isDup) {
              setDupWarning(`⚠️ DN ${rawCandidate} already scanned.`);
              setTimeout(() => setDupWarning(''), 3500);
            } else {
              // Capture the current camera frame for the preview background
              const frame = captureFrame();
              if (frame?.previewUrl) {
                setPreviewUrl(frame.previewUrl);
              }
              setOcrEngine('barcode');
              setOcrResult({
                value: rawCandidate,
                confidence: 'HIGH',
                format: found.format || 'Barcode',
                source: found.source || 'scanner'
              });
              playBeep();
              vibrate();
              setPhase(PHASE.OK);
            }
          }
        }
      } catch (_) {
        // frame decode pass
      } finally {
        scanningBarcodeRef.current = false;
      }
    }, 280);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [phase, isReady, autoBarcode, camError, activeMode, state.records, captureFrame]);

  const handleSetEngine = (choice) => {
    setEngineChoice(choice);
    localStorage.setItem('haeger_ocr_engine', choice);
  };

  // ── Save confirmed value ─────────────────────────────────────────────────────
  const saveValue = useCallback((value, nextMode = null) => {
    // Only DN numbers must be unique. Dockets can be duplicate across multiple invoices.
    const isDup = activeMode === 'invoice' && isDuplicateDN(value, state.records);
    if (isDup) {
      setDupWarning(`⚠️ DN ${value} already scanned.`);
      setTimeout(() => setDupWarning(''), 3500);
      return;
    }
    dispatch({ type: activeMode === 'invoice' ? ACTIONS.ADD_INVOICE : ACTIONS.ADD_DOCKET, payload: value });
    playBeep(); vibrate();

    // Prevent re-triggering auto-scan on this exact barcode for 2.5 seconds
    lastScannedBarcodeRef.current = value;
    barcodeCooldownRef.current = Date.now() + 2500;

    const savedType = activeMode === 'invoice' ? 'DN' : 'Docket';
    setSavedBanner(`✅ Saved ${savedType}: ${value}`);
    setTimeout(() => setSavedBanner(''), 3000);

    if (nextMode && (nextMode === 'invoice' || nextMode === 'docket')) {
      setActiveMode(nextMode);
    }

    setPhase(PHASE.PREVIEW);
    setOcrResult(null);
    setPreviewUrl(null);
    ensureVideo();
  }, [activeMode, state.records, dispatch, ensureVideo]);

  // ── Core OCR processing function (works for both camera and file upload) ──
  const handleProcessImage = useCallback(async (imageDataUrl, processedCanvas = null, options = {}) => {
    if (!imageDataUrl) return;
    const { forceAI = false } = options;

    setPreviewUrl(imageDataUrl);
    setPhase(PHASE.PROCESSING);
    setDupWarning('');
    setLastOcrError('');

    // Give browser UI thread a 100ms yield to render the loading animations before any synchronous OCR work starts
    await new Promise(resolve => setTimeout(resolve, 100));

    // ── Tier 0: Instant Barcode Check on Captured Photo (unless user requested AI OCR) ──
    if (!forceAI && autoBarcode) {
      setProcessingMsg(`Checking for barcode in ${modeLabel} photo…`);
      try {
        const barcode = await scanBarcode(processedCanvas || imageDataUrl);
        if (barcode && barcode.value) {
          const rawCandidate = barcode.value.replace(/[\s\-\.\#\:\/]/g, '');
          if (rawCandidate.length >= 4) {
            setOcrEngine('barcode');
            setOcrResult({
              value: rawCandidate,
              confidence: 'HIGH',
              format: barcode.format || 'Barcode',
              source: barcode.source || 'scanner'
            });
            playBeep();
            vibrate();
            setPhase(PHASE.OK);
            return;
          }
        }
      } catch (barcodeErr) {
        console.warn('Capture barcode scan error:', barcodeErr);
      }
    }

    setProcessingMsg(`Analyzing ${modeLabel} photo with AI…`);

    const key = loadApiKey();
    const activeEngine = engineChoice;

    // ── Tier 1: Cloud AI Vision (if selected or auto with key) ───────────
    if ((activeEngine === 'gemini' || activeEngine === 'auto') && key) {
      try {
        setProcessingMsg(`Connecting to Cloud AI for ${modeLabel}…`);
        setOcrEngine('gemini');
        await new Promise(resolve => setTimeout(resolve, 40));
        const result = await extractWithGemini(imageDataUrl, activeMode, key);
        setProcessingMsg(`Extracting ${fieldLabel}…`);
        setOcrResult(result);
        if (result && result.value) {
          setPhase(PHASE.OK);
          return;
        } else if (activeEngine === 'gemini') {
          setPhase(PHASE.NONE);
          return;
        }
      } catch (err) {
        console.error('Cloud AI OCR error:', err);
        setLastOcrError(`Cloud AI: ${err.message}`);
        if (activeEngine === 'gemini') {
          setDupWarning(`Cloud AI Error: ${err.message}`);
          setPhase(PHASE.NONE);
          return;
        }
        setProcessingMsg(`Cloud AI unavailable. Initializing offline neural engine for ${modeLabel}…`);
      }
    } else if (activeEngine === 'gemini' && !key) {
      setShowApiKey(true);
      setPhase(PHASE.PREVIEW);
      setDupWarning('Please configure your API key first.');
      return;
    }

    // ── Tier 2: In-Browser Neural Engine (Offline AI) ───────────────────────
    if (activeEngine === 'paddle' || activeEngine === 'auto') {
      try {
        setProcessingMsg(`Starting offline engine for ${modeLabel}…`);
        setOcrEngine('paddle');
        await new Promise(resolve => setTimeout(resolve, 40));
        const target = processedCanvas || imageDataUrl;
        const data = await recognizeWithPaddle(target, (msg) => setProcessingMsg(msg));
        setProcessingMsg(`Locating ${fieldLabel} in ${modeLabel}…`);
        const result = isInvoice
          ? extractDNNumber(data.text, data.words)
          : extractDocketNumber(data.text, data.words);

        if (result && result.value && result.confidence !== 'LOW') {
          setOcrResult({ ...result, rawText: data.text });
          setPhase(PHASE.OK);
          return;
        } else if (result && result.value && activeEngine === 'paddle') {
          setOcrResult({ ...result, rawText: data.text });
          setPhase(PHASE.OK);
          return;
        } else if (activeEngine === 'paddle') {
          setOcrResult({
            value: result?.value || '',
            confidence: result?.confidence || 'LOW',
            rawText: data.text || 'No text recognized'
          });
          setPhase(result?.value ? PHASE.OK : PHASE.NONE);
          return;
        }
      } catch (paddleErr) {
        console.error('Offline OCR error:', paddleErr);
        setLastOcrError(`Offline OCR error: ${paddleErr.message}`);
        if (activeEngine === 'paddle') {
          setDupWarning(`Offline OCR error: ${paddleErr.message}`);
          setOcrResult({
            value: '',
            confidence: 'LOW',
            rawText: `Error: ${paddleErr.message}`
          });
          setPhase(PHASE.NONE);
          return;
        }
        setProcessingMsg(`Switching to secondary OCR engine for ${modeLabel}…`);
      }
    }

    // ── Tier 3: Offline standard fallback ──────────────────────────────────
    try {
      setProcessingMsg(`Running standard OCR for ${modeLabel}…`);
      setOcrEngine('tesseract');
      await new Promise(resolve => setTimeout(resolve, 40));
      await initOCR((m) => {
        if (m?.status) setProcessingMsg(`Tesseract: ${m.status}`);
      });
      const target = processedCanvas || imageDataUrl;
      const data   = await recognizeImage(target);
      setProcessingMsg(`Locating ${fieldLabel} in text…`);
      const result = isInvoice
        ? extractDNNumber(data.text, data.words)
        : extractDocketNumber(data.text, data.words);
      setOcrResult({ ...result, rawText: data.text });
      setPhase(result.value && result.confidence !== 'LOW' ? PHASE.OK : PHASE.NONE);
    } catch (err) {
      console.error('Tesseract error:', err);
      setLastOcrError(`Tesseract error: ${err.message}`);
      setPhase(PHASE.NONE);
    }
  }, [activeMode, isInvoice, engineChoice, modeLabel, fieldLabel, autoBarcode]);

  // ── Capture from camera ──────────────────────────────────────────────────────
  const handleCapture = useCallback(async () => {
    setIsCapturing(true);
    setProcessingMsg(`Capturing ${modeLabel}…`);
    const frame = captureFrame();
    if (!frame) {
      setIsCapturing(false);
      return;
    }
    await handleProcessImage(frame.previewUrl, frame.processedCanvas);
    setIsCapturing(false);
  }, [captureFrame, handleProcessImage, modeLabel]);

  const handleRetry = () => {
    setPhase(PHASE.PREVIEW);
    setOcrResult(null);
    setPreviewUrl(null);
    setProcessingMsg('');
    ensureVideo();
  };

  const handleManualSave = (value) => {
    setShowManual(false);
    setEditValue(null);
    saveValue(value);
  };

  const engineBadge = ocrEngine === 'barcode'
    ? { label: `⚡ Barcode (${ocrResult?.format || '1D'})`, cls: 'bg-emerald-950 border border-emerald-600 text-emerald-300' }
    : ocrEngine === 'gemini'
    ? { label: '✨ Cloud AI', cls: 'bg-purple-900 text-purple-300' }
    : ocrEngine === 'paddle'
    ? { label: '⚡ Smart OCR', cls: 'bg-blue-900 text-blue-300' }
    : { label: '🔷 Standard OCR', cls: 'bg-gray-800 text-gray-300' };

  return (
    <div className="min-h-screen bg-black flex flex-col select-none">

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between gap-2 px-3 py-2.5 bg-gradient-to-b from-black/90 to-transparent">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => { stopCamera(); onBack(); }} className="text-white text-2xl leading-none px-1 py-0.5">←</button>
          
          {/* Quick In-Camera Mode Switcher */}
          <div className="flex items-center bg-gray-900/90 p-0.5 rounded-xl border border-gray-700/80">
            <button
              onClick={() => {
                setActiveMode('invoice');
                setPhase(PHASE.PREVIEW);
                ensureVideo();
              }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                isInvoice
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🧾 DN
            </button>
            <button
              onClick={() => {
                setActiveMode('docket');
                setPhase(PHASE.PREVIEW);
                ensureVideo();
              }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                !isInvoice
                  ? 'bg-fuchsia-600 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              📦 Docket
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Barcode live scan toggle */}
          <button
            onClick={() => setAutoBarcode(prev => {
              const next = !prev;
              localStorage.setItem('haeger_auto_barcode', next ? 'true' : 'false');
              return next;
            })}
            className={`text-[11px] font-semibold px-2 py-1 rounded-lg border flex items-center gap-1 transition-all ${
              autoBarcode
                ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                : 'bg-gray-900 border-gray-700 text-gray-400'
            }`}
            title={autoBarcode ? "Live barcode scanning is ON" : "Live barcode scanning is OFF"}
          >
            <span>⚡</span> {autoBarcode ? 'Barcode' : 'Manual'}
          </button>

          {/* Engine Selector */}
          <select
            value={engineChoice}
            onChange={(e) => handleSetEngine(e.target.value)}
            className="text-[11px] bg-gray-900 border border-gray-700 text-gray-200 px-2 py-1 rounded-lg outline-none cursor-pointer max-w-[100px] sm:max-w-none truncate"
            title="Scan Mode"
          >
            <option value="auto">⚡ Auto</option>
            <option value="paddle">⚡ Offline</option>
            <option value="gemini">✨ Cloud AI</option>
            <option value="tesseract">🔷 Standard</option>
          </select>

          {/* API key indicator */}
          <button
            onClick={() => setShowApiKey(true)}
            className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
              apiKey
                ? 'border-purple-700 text-purple-400 bg-purple-950/50'
                : 'border-gray-700 text-gray-500 bg-gray-900/50'
            }`}
          >
            {apiKey ? '🔑' : '🔑 Key'}
          </button>
          <div className="text-xs text-green-400 font-semibold pl-0.5">
            {state.records.filter(r=>r.status==='COMPLETE').length}✓
          </div>
        </div>
      </header>

      <div className="flex-1 relative overflow-hidden bg-black">

        {/* Persistent Camera Video Stream - Never unmounts to prevent camera freezes */}
        <video
          ref={videoRef}
          className={`absolute inset-0 w-full h-full object-contain bg-black transition-opacity duration-200 ${
            phase === PHASE.PREVIEW ? 'opacity-100' : 'opacity-20 pointer-events-none'
          }`}
          autoPlay
          playsInline
          muted
        />

        {/* ─── PREVIEW OVERLAYS ─────────────────────────────────────────────── */}
        {phase === PHASE.PREVIEW && (
          <>
            {camError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950 p-6 gap-4 z-20">
                <span className="text-6xl">📷</span>
                <p className="text-white font-bold text-lg text-center">Camera unavailable</p>
                <p className="text-gray-400 text-sm text-center">{camError}</p>
                <button onClick={() => setShowManual(true)} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold">
                  ✏️ Enter manually
                </button>
              </div>
            ) : (
              <>
                {/* Camera Startup Loading Indicator */}
                {!isReady && !camError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 z-10 gap-3">
                    <div className={`w-12 h-12 border-4 rounded-full animate-spin ${
                      isInvoice
                        ? 'border-gray-700 border-t-cyan-400 border-r-blue-500'
                        : 'border-gray-700 border-t-fuchsia-400 border-r-purple-500'
                    }`} />
                    <p className="text-white text-sm font-semibold">
                      Starting {modeLabel} camera…
                    </p>
                    <p className="text-gray-400 text-xs">
                      Readying video feed
                    </p>
                  </div>
                )}

                {/* Centered Reticle Targeting Box (Encompasses Barcode & Number) */}
                <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[88%] max-w-[340px] h-36 sm:h-40 pointer-events-none z-10 flex flex-col justify-between p-2.5 rounded-2xl border border-white/25 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                  {/* 4 Corner brackets */}
                  <div className="flex justify-between">
                    <div className={`w-5 h-5 border-t-[3px] border-l-[3px] rounded-tl-xl ${
                      isInvoice ? 'border-cyan-400' : 'border-fuchsia-400'
                    }`} />
                    <div className={`w-5 h-5 border-t-[3px] border-r-[3px] rounded-tr-xl ${
                      isInvoice ? 'border-cyan-400' : 'border-fuchsia-400'
                    }`} />
                  </div>

                  {/* Barcode scanner laser guide contained inside box */}
                  {autoBarcode && isReady && (
                    <div className="flex items-center justify-center my-auto">
                      <div className={`w-4/5 h-[2px] rounded-full animate-pulse ${
                        isInvoice
                          ? 'bg-cyan-400 shadow-[0_0_10px_#38bdf8]'
                          : 'bg-fuchsia-400 shadow-[0_0_10px_#d946ef]'
                      }`} />
                    </div>
                  )}

                  <div className="flex justify-between">
                    <div className={`w-5 h-5 border-b-[3px] border-l-[3px] rounded-bl-xl ${
                      isInvoice ? 'border-cyan-400' : 'border-fuchsia-400'
                    }`} />
                    <div className={`w-5 h-5 border-b-[3px] border-r-[3px] rounded-tr-xl ${
                      isInvoice ? 'border-cyan-400' : 'border-fuchsia-400'
                    }`} />
                  </div>
                </div>

                {/* Clean, single-line guide instruction */}
                <div className="absolute top-[58%] sm:top-[60%] left-0 right-0 pointer-events-none flex justify-center z-10 px-4">
                  <div className="px-3.5 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/10 text-center shadow-lg">
                    <p className="text-xs font-medium text-gray-200">
                      Align <span className={isInvoice ? 'text-cyan-300 font-semibold' : 'text-fuchsia-300 font-semibold'}>
                        {isInvoice ? 'DN number & barcode' : 'Docket number & barcode'}
                      </span> inside box
                    </p>
                  </div>
                </div>

                {/* Banners */}
                {savedBanner && (
                  <div className="absolute top-16 left-4 right-4 z-20 bg-green-900/90 border border-green-600 rounded-xl px-4 py-3 text-green-300 text-center font-semibold text-lg shadow-xl">
                    {savedBanner}
                  </div>
                )}
                {dupWarning && (
                  <div className="absolute top-16 left-4 right-4 z-20 bg-yellow-900/90 border border-yellow-600 rounded-xl px-4 py-3 text-yellow-300 text-center text-sm shadow-xl">
                    {dupWarning}
                  </div>
                )}

                {/* Capture Controls */}
                <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center pb-6 pt-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-10">
                  {/* Shutter row with Upload button */}
                  <div className="flex items-center gap-6">
                    {/* File / Camera upload button */}
                    <label className="flex flex-col items-center justify-center w-12 h-12 rounded-full bg-gray-800/90 border border-gray-600 text-white cursor-pointer hover:bg-gray-700 active:scale-95 transition-all shadow-lg" title="Upload Image / Take High-Res Photo">
                      <span className="text-xl">📁</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setPhase(PHASE.PROCESSING);
                            setProcessingMsg(`Loading ${modeLabel} photo…`);
                            const reader = new FileReader();
                            reader.onload = () => handleProcessImage(reader.result);
                            reader.readAsDataURL(file);
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>

                    {/* Main Shutter with active spinning state */}
                    <button
                      onClick={handleCapture}
                      disabled={!isReady || isCapturing}
                      className="w-18 h-18 md:w-20 md:h-20 rounded-full bg-white border-4 border-gray-300 shadow-2xl active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center relative"
                      aria-label="Capture Photo"
                    >
                      {isCapturing ? (
                        <div className={`w-10 h-10 border-4 border-gray-300 rounded-full animate-spin ${
                          isInvoice ? 'border-t-cyan-600' : 'border-t-fuchsia-600'
                        }`} />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-white border-2 border-gray-400" />
                      )}
                    </button>

                    {/* Manual entry shortcut */}
                    <button
                      onClick={() => setShowManual(true)}
                      className="flex flex-col items-center justify-center w-12 h-12 rounded-full bg-gray-800/90 border border-gray-600 text-white hover:bg-gray-700 active:scale-95 transition-all shadow-lg"
                      title="Enter Manually"
                    >
                      <span className="text-xl">✏️</span>
                    </button>
                  </div>

                  <p className="text-gray-400 text-xs mt-2">Auto-scans barcode inside box · Tap shutter for photo</p>
                </div>
              </>
            )}
          </>
        )}

        {/* ─── PROCESSING / EXTRACTING LOADING SCREEN (BOTH INVOICE & DOCKET) ── */}
        {phase === PHASE.PROCESSING && (
          <div className="absolute inset-0 flex flex-col bg-black">
            {/* Captured document preview with animated laser scanner */}
            <div className="relative w-full flex-1 overflow-hidden flex items-center justify-center bg-gray-950">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt={`Processing ${modeLabel} document`}
                  className="w-full h-full object-contain opacity-55 filter brightness-95"
                />
              )}

              {/* Glowing animated laser scan beam across document */}
              <div className={`left-0 right-0 h-1 pointer-events-none ${
                isInvoice
                  ? 'animate-laser-scan bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_20px_#38bdf8]'
                  : 'animate-laser-scan-purple bg-gradient-to-r from-transparent via-fuchsia-400 to-transparent shadow-[0_0_20px_#d946ef]'
              }`} />

              {/* Scanning corner reticles */}
              <div className={`absolute inset-4 md:inset-8 pointer-events-none border rounded-2xl flex flex-col justify-between p-3 ${
                isInvoice ? 'border-cyan-500/30' : 'border-fuchsia-500/30'
              }`}>
                <div className="flex justify-between">
                  <div className={`w-6 h-6 border-t-2 border-l-2 ${isInvoice ? 'border-cyan-400' : 'border-fuchsia-400'}`} />
                  <div className={`w-6 h-6 border-t-2 border-r-2 ${isInvoice ? 'border-cyan-400' : 'border-fuchsia-400'}`} />
                </div>
                <div className="flex justify-between">
                  <div className={`w-6 h-6 border-b-2 border-l-2 ${isInvoice ? 'border-cyan-400' : 'border-fuchsia-400'}`} />
                  <div className={`w-6 h-6 border-b-2 border-r-2 ${isInvoice ? 'border-cyan-400' : 'border-fuchsia-400'}`} />
                </div>
              </div>
            </div>

            {/* Bottom Extraction Card */}
            <div className="absolute inset-x-0 bottom-0 z-30 p-4 pb-8 bg-gradient-to-t from-black via-black/95 to-transparent">
              <div className="bg-gray-900/95 backdrop-blur-md rounded-2xl p-5 border border-gray-700/80 shadow-2xl max-w-sm mx-auto flex flex-col items-center text-center">
                
                {/* Mode & Engine Badges */}
                <div className="flex items-center gap-2 mb-3 flex-wrap justify-center">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                    isInvoice
                      ? 'bg-blue-950/80 border-blue-700/60 text-blue-300'
                      : 'bg-purple-950/80 border-purple-700/60 text-purple-300'
                  }`}>
                    {isInvoice ? '🧾 Invoice Scan' : '📦 Docket Scan'}
                  </span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${engineBadge.cls}`}>
                    {engineBadge.label}
                  </span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border animate-pulse ${
                    isInvoice
                      ? 'text-cyan-300 bg-cyan-950/80 border-cyan-800'
                      : 'text-fuchsia-300 bg-fuchsia-950/80 border-fuchsia-800'
                  }`}>
                    ⚡ Processing
                  </span>
                </div>

                {/* Animated Scanner Ring */}
                <div className="relative w-16 h-16 mb-3 flex items-center justify-center">
                  <div className={`absolute inset-0 rounded-full border-4 border-gray-700 animate-spin ${
                    isInvoice
                      ? 'border-t-cyan-400 border-r-blue-500'
                      : 'border-t-fuchsia-400 border-r-purple-500'
                  }`} />
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center animate-pulse ${
                    isInvoice ? 'bg-cyan-500/20' : 'bg-fuchsia-500/20'
                  }`}>
                    <span className="text-lg">{isInvoice ? '🧾' : '📦'}</span>
                  </div>
                </div>

                {/* Primary Loading Title */}
                <h3 className="text-white font-bold text-lg mb-1 tracking-wide">
                  Extracting {fieldLabel}…
                </h3>

                {/* Dynamic Status / Progress Subtext */}
                <p className={`text-xs font-medium mb-3 min-h-[18px] transition-all ${
                  isInvoice ? 'text-cyan-300' : 'text-fuchsia-300'
                }`}>
                  {processingMsg || 'Detecting & reading numbers…'}
                </p>

                {/* Animated Shimmer Bar */}
                <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden mb-2">
                  <div className={`h-full rounded-full w-full animate-pulse ${
                    isInvoice
                      ? 'bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500'
                      : 'bg-gradient-to-r from-fuchsia-500 via-purple-500 to-pink-500'
                  }`} />
                </div>

                <span className="text-[11px] text-gray-400">
                  Scanning document digits &amp; labels in real time
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ─── RESULT FOUND ─────────────────────────────────────────────────── */}
        {phase === PHASE.OK && ocrResult && (
          <div className="absolute inset-0 flex flex-col z-20">
            {previewUrl && <img src={previewUrl} alt="Captured" className="w-full flex-1 object-contain bg-black opacity-35" />}
            <div className="absolute inset-x-0 bottom-0 bg-gray-950 rounded-t-3xl border-t border-gray-700 shadow-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-400 text-sm font-medium">{fieldLabel} found</span>
                <div className="flex gap-2">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${engineBadge.cls}`}>
                    {engineBadge.label}
                  </span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    ocrResult.confidence === 'HIGH' ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'
                  }`}>
                    {ocrResult.confidence === 'HIGH' ? '✓ Verified' : '⚠ Verify'}
                  </span>
                </div>
              </div>

              <div className="bg-gray-800/90 rounded-2xl px-6 py-4 mb-4 text-center border border-gray-700/60">
                <p className="text-white text-3xl font-mono font-bold tracking-widest break-all">
                  {ocrResult.value}
                </p>
              </div>

              <div className="flex flex-col gap-2.5">
                {/* 1. Rapid Scan: Save and scan next immediately */}
                <button
                  onClick={() => saveValue(ocrResult.value)}
                  className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3.5 rounded-2xl text-base transition-colors shadow-lg active:scale-98 flex items-center justify-center gap-2"
                >
                  <span>✓</span>
                  <span>Save &amp; Scan Next {isInvoice ? 'DN' : 'Docket'}</span>
                </button>

                {/* 2. Rapid Scan: Save and switch mode immediately */}
                <button
                  onClick={() => saveValue(ocrResult.value, isInvoice ? 'docket' : 'invoice')}
                  className={`w-full text-white font-semibold py-3 rounded-2xl text-sm transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 border ${
                    isInvoice
                      ? 'bg-fuchsia-900/80 hover:bg-fuchsia-800 border-fuchsia-600 text-fuchsia-100'
                      : 'bg-cyan-900/80 hover:bg-cyan-800 border-cyan-600 text-cyan-100'
                  }`}
                >
                  <span>⇄</span>
                  <span>Save &amp; Switch to {isInvoice ? '📦 Docket' : '🧾 DN'}</span>
                </button>

                {/* If scanned via Barcode, offer instant 1-tap "Wrong number? Scan with AI OCR" */}
                {ocrEngine === 'barcode' && (
                  <button
                    onClick={() => handleProcessImage(previewUrl, null, { forceAI: true })}
                    className="w-full bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium py-2.5 rounded-xl text-xs border border-gray-700 flex items-center justify-center gap-2 transition-all active:scale-98"
                  >
                    <span>🤖</span> Wrong number? Scan with AI OCR
                  </button>
                )}

                <div className="flex gap-2.5">
                  <button
                    onClick={() => { setEditValue(ocrResult.value); setShowManual(true); }}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold py-2.5 rounded-xl text-sm transition-colors border border-gray-700"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={handleRetry}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold py-2.5 rounded-xl text-sm transition-colors border border-gray-700"
                  >
                    📷 Retake
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── NOT FOUND ────────────────────────────────────────────────────── */}
        {phase === PHASE.NONE && (
          <div className="absolute inset-0 flex flex-col">
            {previewUrl && <img src={previewUrl} alt="Captured" className="w-full flex-1 object-contain bg-black opacity-40" />}
            <div className="absolute inset-x-0 bottom-0 bg-gray-950 rounded-t-3xl border-t border-gray-700 shadow-2xl p-6">
              <div className="text-center mb-5">
                <div className="text-5xl mb-3">🔍</div>
                <h2 className="text-white font-bold text-xl mb-2">{fieldLabel} not found</h2>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Ensure the <span className="text-gray-200 font-medium">{fieldLabel}</span> label
                  and number are clearly visible, well-lit, and in focus.
                </p>
                {ocrResult?.raw && (
                  <div className="mt-3 p-2 bg-gray-900 border border-gray-800 rounded-lg text-[11px] font-mono text-gray-400 break-all max-h-24 overflow-y-auto">
                    AI response: {ocrResult.raw}
                  </div>
                )}
                {ocrResult?.rawText && (
                  <div className="mt-2 p-2 bg-gray-900 border border-gray-800 rounded-lg text-[11px] font-mono text-gray-400 text-left max-h-24 overflow-y-auto whitespace-pre-wrap">
                    <div className="text-gray-300 font-bold mb-0.5">Detected Text:</div>
                    {ocrResult.rawText.slice(0, 400)}
                  </div>
                )}
                {lastOcrError && (
                  <div className="mt-2 p-2 bg-red-950/70 border border-red-800 rounded-lg text-[11px] font-mono text-red-300 text-left break-all">
                    {lastOcrError}
                  </div>
                )}
                {!apiKey && engineChoice === 'auto' && (
                  <button onClick={() => setShowApiKey(true)}
                    className="mt-3 text-purple-400 text-sm underline underline-offset-2">
                    ✨ Add API key for highest accuracy
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <button onClick={handleRetry}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl text-lg transition-colors">
                  📷 Try again
                </button>
                <button onClick={() => { setEditValue(''); setShowManual(true); }}
                  className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-xl transition-colors">
                  ✏️ Enter manually
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showManual && (
        <ManualEntryDialog mode={activeMode} initialValue={editValue || ''}
          onConfirm={handleManualSave} onCancel={() => { setShowManual(false); setEditValue(null); }} />
      )}

      {showApiKey && (
        <ApiKeyModal currentKey={apiKey} onSave={setApiKey} onClose={() => setShowApiKey(false)} />
      )}
    </div>
  );
}
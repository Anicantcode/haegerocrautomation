import { useState, useEffect, useCallback } from 'react';
import { useApp, ACTIONS, isDuplicateDN, isDuplicateDocket } from '../context/AppContext.jsx';
import { useCamera } from '../hooks/useCamera.js';
import { extractWithGemini, loadApiKey } from '../ocr/geminiOCR.js';
import { recognizeWithPaddle } from '../ocr/paddleProcessor.js';
import { initOCR, recognizeImage } from '../ocr/ocrProcessor.js';
import { extractDNNumber } from '../ocr/invoiceExtractor.js';
import { extractDocketNumber } from '../ocr/docketExtractor.js';
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
  const { videoRef, isReady, error: camError, startCamera, stopCamera, captureFrame } = useCamera();

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

  const modeLabel  = mode === 'invoice' ? 'Invoice' : 'Docket';
  const fieldLabel = mode === 'invoice' ? 'DN No.'  : 'Consignment Note No.';

  useEffect(() => { startCamera(); return () => stopCamera(); }, []); // eslint-disable-line

  const handleSetEngine = (choice) => {
    setEngineChoice(choice);
    localStorage.setItem('haeger_ocr_engine', choice);
  };

  // ── Save confirmed value ─────────────────────────────────────────────────────
  const saveValue = useCallback((value) => {
    const isDup = mode === 'invoice'
      ? isDuplicateDN(value, state.records)
      : isDuplicateDocket(value, state.records);
    if (isDup) {
      setDupWarning(`⚠️ ${value} already scanned.`);
      setTimeout(() => setDupWarning(''), 3500);
      return;
    }
    dispatch({ type: mode === 'invoice' ? ACTIONS.ADD_INVOICE : ACTIONS.ADD_DOCKET, payload: value });
    playBeep(); vibrate();
    setSavedBanner(`✅ Saved: ${value}`);
    setTimeout(() => setSavedBanner(''), 3000);
    setPhase(PHASE.PREVIEW);
    setOcrResult(null);
    setPreviewUrl(null);
  }, [mode, state.records, dispatch]);

  // ── Core OCR processing function (works for both camera and file upload) ──
  const handleProcessImage = useCallback(async (imageDataUrl, processedCanvas = null) => {
    if (!imageDataUrl) return;

    setPreviewUrl(imageDataUrl);
    setPhase(PHASE.PROCESSING);
    setDupWarning('');
    setLastOcrError('');

    const key = loadApiKey();
    const activeEngine = engineChoice;

    // ── Tier 1: Gemini AI Vision (if selected or auto with key) ───────────
    if ((activeEngine === 'gemini' || activeEngine === 'auto') && key) {
      try {
        setProcessingMsg('Connecting to Gemini AI Vision…');
        setOcrEngine('gemini');
        const result = await extractWithGemini(imageDataUrl, mode, key);
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
        console.error('Gemini OCR error:', err);
        setLastOcrError(`Gemini: ${err.message}`);
        if (activeEngine === 'gemini') {
          setDupWarning(`Gemini AI Error: ${err.message}`);
          setPhase(PHASE.NONE);
          return;
        }
        setProcessingMsg(`Gemini unavailable (${err.message}). Trying Baidu PaddleOCR…`);
      }
    } else if (activeEngine === 'gemini' && !key) {
      setShowApiKey(true);
      setPhase(PHASE.PREVIEW);
      setDupWarning('Please enter your Gemini API key first.');
      return;
    }

    // ── Tier 2: In-Browser Baidu PaddleOCR v4 (Offline AI) ─────────────────
    if (activeEngine === 'paddle' || activeEngine === 'auto') {
      try {
        setProcessingMsg('Starting Baidu PaddleOCR v4…');
        setOcrEngine('paddle');
        const target = processedCanvas || imageDataUrl;
        const data = await recognizeWithPaddle(target, (msg) => setProcessingMsg(msg));
        setProcessingMsg(`Locating ${fieldLabel} in document…`);
        const result = mode === 'invoice'
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
            rawText: data.text || 'No text recognized by PaddleOCR'
          });
          setPhase(result?.value ? PHASE.OK : PHASE.NONE);
          return;
        }
      } catch (paddleErr) {
        console.error('PaddleOCR error:', paddleErr);
        setLastOcrError(`PaddleOCR error: ${paddleErr.message}`);
        if (activeEngine === 'paddle') {
          setDupWarning(`PaddleOCR error: ${paddleErr.message}`);
          setOcrResult({
            value: '',
            confidence: 'LOW',
            rawText: `Error: ${paddleErr.message}`
          });
          setPhase(PHASE.NONE);
          return;
        }
        setProcessingMsg(`PaddleOCR error (${paddleErr.message}). Trying Tesseract…`);
      }
    }

    // ── Tier 3: Offline Tesseract fallback ──────────────────────────────────
    try {
      setProcessingMsg('Running on-device Tesseract OCR…');
      setOcrEngine('tesseract');
      await initOCR((m) => {
        if (m?.status) setProcessingMsg(`Tesseract: ${m.status}`);
      });
      const target = processedCanvas || imageDataUrl;
      const data   = await recognizeImage(target);
      setProcessingMsg(`Locating ${fieldLabel} in text…`);
      const result = mode === 'invoice'
        ? extractDNNumber(data.text, data.words)
        : extractDocketNumber(data.text, data.words);
      setOcrResult({ ...result, rawText: data.text });
      setPhase(result.value && result.confidence !== 'LOW' ? PHASE.OK : PHASE.NONE);
    } catch (err) {
      console.error('Tesseract error:', err);
      setLastOcrError(`Tesseract error: ${err.message}`);
      setPhase(PHASE.NONE);
    }
  }, [mode, engineChoice]);

  // ── Capture from camera ──────────────────────────────────────────────────────
  const handleCapture = useCallback(() => {
    const frame = captureFrame();
    if (!frame) return;
    handleProcessImage(frame.previewUrl, frame.processedCanvas);
  }, [captureFrame, handleProcessImage]);

  const handleRetry = () => {
    setPhase(PHASE.PREVIEW);
    setOcrResult(null);
    setPreviewUrl(null);
    setProcessingMsg('');
  };

  const handleManualSave = (value) => {
    setShowManual(false);
    setEditValue(null);
    saveValue(value);
  };

  const engineBadge = ocrEngine === 'gemini'
    ? { label: '✨ Gemini AI', cls: 'bg-purple-900 text-purple-300' }
    : ocrEngine === 'paddle'
    ? { label: '🀄 PaddleOCR v4', cls: 'bg-blue-900 text-blue-300' }
    : { label: '🔷 Tesseract', cls: 'bg-gray-800 text-gray-300' };

  return (
    <div className="min-h-screen bg-black flex flex-col select-none">

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between gap-2 px-3 py-2.5 bg-gradient-to-b from-black/90 to-transparent">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => { stopCamera(); onBack(); }} className="text-white text-2xl leading-none">←</button>
          <div className="min-w-0">
            <h1 className="text-white font-bold text-base truncate">Scan {modeLabel}</h1>
            <p className="text-gray-300 text-[11px] truncate">{fieldLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Engine Selector */}
          <select
            value={engineChoice}
            onChange={(e) => handleSetEngine(e.target.value)}
            className="text-[11px] bg-gray-900 border border-gray-700 text-gray-200 px-2 py-1 rounded-lg outline-none cursor-pointer max-w-[140px] sm:max-w-none truncate"
            title="Choose OCR Engine"
          >
            <option value="auto">⚡ Auto Waterfall</option>
            <option value="paddle">🀄 Baidu PaddleOCR (Offline)</option>
            <option value="gemini">✨ Gemini Vision (Cloud)</option>
            <option value="tesseract">🔷 Tesseract (Legacy)</option>
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
            {apiKey ? '🔑 AI' : '🔑 Key'}
          </button>
          <div className="text-xs text-green-400 font-semibold pl-1">
            {state.records.filter(r=>r.status==='COMPLETE').length}✓
          </div>
        </div>
      </header>

      <div className="flex-1 relative overflow-hidden">

        {/* ─── PREVIEW ──────────────────────────────────────────────────────── */}
        {phase === PHASE.PREVIEW && (
          <>
            {camError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950 p-6 gap-4">
                <span className="text-6xl">📷</span>
                <p className="text-white font-bold text-lg text-center">Camera unavailable</p>
                <p className="text-gray-400 text-sm text-center">{camError}</p>
                <button onClick={() => setShowManual(true)} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold">
                  ✏️ Enter manually
                </button>
              </div>
            ) : (
              <>
                {/* Full-view Camera Stream */}
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-contain bg-black"
                  autoPlay
                  playsInline
                  muted
                />

                {/* Subtle corner framing indicators */}
                <div className="absolute inset-4 md:inset-8 pointer-events-none border border-white/20 rounded-2xl flex flex-col justify-between p-3">
                  <div className="flex justify-between">
                    <div className="w-6 h-6 border-t-2 border-l-2 border-yellow-400 rounded-tl-lg" />
                    <div className="w-6 h-6 border-t-2 border-r-2 border-yellow-400 rounded-tr-lg" />
                  </div>
                  <p className="text-center text-white/90 text-xs md:text-sm font-medium bg-black/60 backdrop-blur-sm py-1 px-3 rounded-full mx-auto shadow">
                    Position {modeLabel} ({fieldLabel}) in view
                  </p>
                  <div className="flex justify-between">
                    <div className="w-6 h-6 border-b-2 border-l-2 border-yellow-400 rounded-bl-lg" />
                    <div className="w-6 h-6 border-b-2 border-r-2 border-yellow-400 rounded-br-lg" />
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
                <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center pb-6 pt-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                  {/* Engine label */}
                  <p className="text-xs mb-3 px-3 py-1 rounded-full border border-gray-700 bg-gray-900/80 text-gray-300 backdrop-blur-sm">
                    {apiKey ? '✨ Gemini AI Vision Active' : '🔷 Local OCR · Tap 🔑 to enable AI'}
                  </p>

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
                            const reader = new FileReader();
                            reader.onload = () => handleProcessImage(reader.result);
                            reader.readAsDataURL(file);
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>

                    {/* Main Shutter */}
                    <button
                      onClick={handleCapture}
                      disabled={!isReady}
                      className="w-18 h-18 md:w-20 md:h-20 rounded-full bg-white border-4 border-gray-300 shadow-2xl active:scale-95 transition-transform disabled:opacity-40 flex items-center justify-center"
                      aria-label="Capture Photo"
                    >
                      <div className="w-14 h-14 rounded-full bg-white border-2 border-gray-400" />
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

                  <p className="text-gray-400 text-xs mt-2">Tap shutter to capture or 📁 to upload</p>
                </div>
              </>
            )}
          </>
        )}

        {/* ─── PROCESSING / EXTRACTING LOADING SCREEN ────────────────────────── */}
        {phase === PHASE.PROCESSING && (
          <div className="absolute inset-0 flex flex-col bg-black">
            {/* Captured document preview with animated laser scanner */}
            <div className="relative w-full flex-1 overflow-hidden flex items-center justify-center bg-gray-950">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Processing document"
                  className="w-full h-full object-contain opacity-50 filter brightness-90"
                />
              )}

              {/* Glowing animated laser scan beam across document */}
              <div className="animate-laser-scan left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_18px_#38bdf8] pointer-events-none" />

              {/* Scanning corner reticles */}
              <div className="absolute inset-4 md:inset-8 pointer-events-none border border-cyan-500/30 rounded-2xl flex flex-col justify-between p-3">
                <div className="flex justify-between">
                  <div className="w-5 h-5 border-t-2 border-l-2 border-cyan-400" />
                  <div className="w-5 h-5 border-t-2 border-r-2 border-cyan-400" />
                </div>
                <div className="flex justify-between">
                  <div className="w-5 h-5 border-b-2 border-l-2 border-cyan-400" />
                  <div className="w-5 h-5 border-b-2 border-r-2 border-cyan-400" />
                </div>
              </div>
            </div>

            {/* Bottom Extraction Card */}
            <div className="absolute inset-x-0 bottom-0 z-30 p-4 pb-8 bg-gradient-to-t from-black via-black/95 to-transparent">
              <div className="bg-gray-900/90 backdrop-blur-md rounded-2xl p-5 border border-gray-700/80 shadow-2xl max-w-sm mx-auto flex flex-col items-center text-center">
                
                {/* Engine Badge */}
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${engineBadge.cls}`}>
                    {engineBadge.label}
                  </span>
                  <span className="text-[11px] text-cyan-300 bg-cyan-950/80 border border-cyan-800 px-2 py-0.5 rounded-full font-medium">
                    ⚡ Processing
                  </span>
                </div>

                {/* Animated Scanner Ring */}
                <div className="relative w-14 h-14 mb-3 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-gray-700 border-t-cyan-400 border-r-blue-500 animate-spin" />
                  <div className="w-7 h-7 rounded-full bg-cyan-500/20 flex items-center justify-center animate-pulse">
                    <span className="text-base">📄</span>
                  </div>
                </div>

                {/* Primary Loading Title */}
                <h3 className="text-white font-bold text-lg mb-1 tracking-wide">
                  Extracting {fieldLabel}…
                </h3>

                {/* Dynamic Status / Progress Subtext */}
                <p className="text-cyan-300 text-xs font-medium mb-3 min-h-[18px] transition-all">
                  {processingMsg || 'Detecting & reading numbers…'}
                </p>

                {/* Animated Shimmer Bar */}
                <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 rounded-full w-full animate-pulse" />
                </div>

                <span className="text-[11px] text-gray-400">
                  Scanning document digits &amp; labels
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ─── RESULT FOUND ─────────────────────────────────────────────────── */}
        {phase === PHASE.OK && ocrResult && (
          <div className="absolute inset-0 flex flex-col">
            {previewUrl && <img src={previewUrl} alt="Captured" className="w-full flex-1 object-contain bg-black opacity-35" />}
            <div className="absolute inset-x-0 bottom-0 bg-gray-950 rounded-t-3xl border-t border-gray-700 shadow-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-400 text-sm">{fieldLabel} found</span>
                <div className="flex gap-2">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${engineBadge.cls}`}>
                    {engineBadge.label}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    ocrResult.confidence === 'HIGH' ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'
                  }`}>
                    {ocrResult.confidence === 'HIGH' ? '✓ High confidence' : '⚠ Verify'}
                  </span>
                </div>
              </div>

              <div className="bg-gray-800 rounded-2xl px-6 py-5 mb-5 text-center">
                <p className="text-white text-3xl font-mono font-bold tracking-widest break-all">
                  {ocrResult.value}
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button onClick={() => saveValue(ocrResult.value)}
                  className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-2xl text-lg transition-colors">
                  ✓ Save this number
                </button>
                <div className="flex gap-3">
                  <button onClick={() => { setEditValue(ocrResult.value); setShowManual(true); }}
                    className="flex-1 bg-blue-700 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl transition-colors">
                    ✏️ Edit
                  </button>
                  <button onClick={handleRetry}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-xl transition-colors">
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
                    <div className="text-gray-300 font-bold mb-0.5">Detected Text ({ocrEngine}):</div>
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
                    ✨ Add Gemini AI key for 99%+ accuracy
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
        <ManualEntryDialog mode={mode} initialValue={editValue || ''}
          onConfirm={handleManualSave} onCancel={() => { setShowManual(false); setEditValue(null); }} />
      )}

      {showApiKey && (
        <ApiKeyModal currentKey={apiKey} onSave={setApiKey} onClose={() => setShowApiKey(false)} />
      )}
    </div>
  );
}
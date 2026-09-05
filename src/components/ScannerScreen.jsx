import { useState, useEffect, useCallback } from 'react';
import { useApp, ACTIONS, isDuplicateDN, isDuplicateDocket } from '../context/AppContext.jsx';
import { useCamera } from '../hooks/useCamera.js';
import { extractWithGemini, loadApiKey } from '../ocr/geminiOCR.js';
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
  const [ocrEngine,     setOcrEngine]      = useState('');   // 'gemini' | 'tesseract'
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

    const key = loadApiKey();

    // ── Primary Engine: Gemini AI ───────────────────────────────────────────
    if (key) {
      try {
        setProcessingMsg('Analyzing with Gemini AI Vision…');
        setOcrEngine('gemini');
        const result = await extractWithGemini(imageDataUrl, mode, key);
        setOcrResult(result);
        if (result && result.value) {
          setPhase(PHASE.OK);
        } else {
          setPhase(PHASE.NONE);
        }
        return;
      } catch (err) {
        console.error('Gemini OCR error:', err);
        setDupWarning(`Gemini AI Error: ${err.message}`);
        // If Gemini failed due to invalid key or error, allow retry
        setProcessingMsg(`Gemini AI error: ${err.message}. Running on-device OCR…`);
      }
    }

    // ── Secondary Engine: Offline Tesseract (only if no key or error) ────────
    try {
      setProcessingMsg('Running on-device OCR…');
      setOcrEngine('tesseract');
      await initOCR();
      const target = processedCanvas || imageDataUrl;
      const data   = await recognizeImage(target);
      const result = mode === 'invoice'
        ? extractDNNumber(data.text, data.words)
        : extractDocketNumber(data.text, data.words);
      setOcrResult(result);
      setPhase(result.value && result.confidence !== 'LOW' ? PHASE.OK : PHASE.NONE);
    } catch (err) {
      console.error('Tesseract error:', err);
      setPhase(PHASE.NONE);
    }
  }, [mode]);

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
    : { label: '🔷 On-device', cls: 'bg-gray-800 text-gray-300' };

  return (
    <div className="min-h-screen bg-black flex flex-col select-none">

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center gap-3 px-4 py-3 bg-gradient-to-b from-black/80 to-transparent">
        <button onClick={() => { stopCamera(); onBack(); }} className="text-white text-3xl leading-none">←</button>
        <div>
          <h1 className="text-white font-bold text-lg">Scan {modeLabel}</h1>
          <p className="text-gray-300 text-xs">{fieldLabel}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* API key indicator */}
          <button
            onClick={() => setShowApiKey(true)}
            className={`text-xs px-2 py-1 rounded-full border transition-colors ${
              apiKey
                ? 'border-purple-700 text-purple-400 bg-purple-950/50'
                : 'border-gray-700 text-gray-500 bg-gray-900/50'
            }`}
          >
            {apiKey ? '🔑 AI' : '🔑 Set key'}
          </button>
          <div className="flex gap-2 text-xs">
            <span className="text-green-400">{state.records.filter(r=>r.status==='COMPLETE').length} ✓</span>
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

        {/* ─── PROCESSING ───────────────────────────────────────────────────── */}
        {phase === PHASE.PROCESSING && (
          <div className="absolute inset-0 flex flex-col">
            {previewUrl && <img src={previewUrl} alt="Captured" className="w-full flex-1 object-contain bg-black" />}
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-16 bg-black/60">
              <div className="bg-gray-900/95 rounded-2xl px-8 py-6 flex flex-col items-center gap-4 border border-gray-700 shadow-2xl mx-4 w-full max-w-xs">
                <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-white font-semibold text-lg text-center">{processingMsg || 'Reading document…'}</p>
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
                {!apiKey && (
                  <button onClick={() => setShowApiKey(true)}
                    className="mt-3 text-purple-400 text-sm underline underline-offset-2">
                    ✨ Add Gemini AI key for better accuracy
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
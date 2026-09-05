import { useState } from 'react';
import { saveApiKey, clearApiKey, testGeminiApiKey } from '../ocr/geminiOCR.js';

export function ApiKeyModal({ currentKey, onSave, onClose }) {
  const [key,      setKey]      = useState(currentKey ?? '');
  const [show,     setShow]     = useState(false);
  const [testing,  setTesting]  = useState(false);
  const [testMsg,  setTestMsg]  = useState('');
  const [testOk,   setTestOk]   = useState(null);

  const handleTestAndSave = async () => {
    const trimmed = key.trim();
    if (!trimmed) return;
    setTesting(true);
    setTestMsg('Verifying key with Google Gemini API…');
    setTestOk(null);

    try {
      await testGeminiApiKey(trimmed);
      saveApiKey(trimmed);
      onSave(trimmed);
      setTestOk(true);
      setTestMsg('✅ Key is valid and active!');
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err) {
      setTestOk(false);
      setTestMsg(`❌ ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  const handleClear = () => {
    clearApiKey();
    setKey('');
    onSave('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl border border-gray-700 p-6">

        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">🔑</span>
          <div>
            <h2 className="text-white font-bold text-lg">Gemini API Key</h2>
            <p className="text-gray-400 text-xs">Used for fast &amp; accurate document reading</p>
          </div>
        </div>

        {/* How to get key */}
        <div className="bg-blue-950/60 border border-blue-800 rounded-xl p-3 mb-4 text-xs text-blue-300 leading-relaxed">
          <strong className="text-blue-200">Get a free key:</strong>{' '}
          Visit{' '}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-blue-200 underline underline-offset-2 hover:text-white"
          >
            aistudio.google.com
          </a>
          {' '}→ Create API Key. (100% Free: 1,500 requests/day).
        </div>

        {/* Input */}
        <div className="relative mb-3">
          <input
            type={show ? 'text' : 'password'}
            value={key}
            onChange={e => {
              setKey(e.target.value);
              setTestMsg('');
              setTestOk(null);
            }}
            placeholder="AIzaSy..."
            className="w-full bg-gray-800 border border-gray-600 focus:border-blue-500 outline-none text-white font-mono text-sm rounded-xl px-4 py-3 pr-14"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
          />
          <button
            onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs px-2 py-1"
          >{show ? 'Hide' : 'Show'}</button>
        </div>

        {/* Status / Error message */}
        {testMsg && (
          <div className={`p-3 rounded-xl text-xs mb-4 border ${
            testOk === true
              ? 'bg-green-950/80 border-green-700 text-green-300'
              : testOk === false
              ? 'bg-red-950/80 border-red-700 text-red-300'
              : 'bg-gray-800 border-gray-700 text-gray-300'
          }`}>
            {testMsg}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-xl transition-colors"
          >Cancel</button>
          {currentKey && (
            <button
              onClick={handleClear}
              className="bg-red-900 hover:bg-red-800 text-red-300 font-semibold py-3 px-4 rounded-xl transition-colors"
            >Remove</button>
          )}
          <button
            onClick={handleTestAndSave}
            disabled={!key.trim() || testing}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {testing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Verifying…</span>
              </>
            ) : (
              <span>Save &amp; Verify</span>
            )}
          </button>
        </div>

        <p className="text-gray-500 text-[11px] text-center mt-4">
          Key is stored in your browser's local storage and sent directly to Google's API.
        </p>
      </div>
    </div>
  );
}
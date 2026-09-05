import { useState } from 'react';
import {
  formatRecordsForWhatsApp,
  formatRecordsForClipboard,
  createCsvBlob
} from '../export/excelExporter.js';

export function ShareModal({ isOpen, onClose, fileData, records }) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [shareErr, setShareErr] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  if (!isOpen || !fileData) return null;

  const totalCount = records?.length || 0;
  const completeCount = records?.filter(r => r.status === 'COMPLETE').length || 0;

  // 1. Native Web Share API
  const handleNativeShare = async () => {
    setIsSharing(true);
    setShareErr('');
    try {
      // Create fresh File instance right on user gesture
      const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const freshFile = new File([fileData.blob], fileData.filename, {
        type: mimeType,
        lastModified: Date.now()
      });

      // Try XLSX share
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [freshFile] })) {
        await navigator.share({
          files: [freshFile]
        });
        setIsSharing(false);
        return;
      }

      // Fallback: try sharing as CSV if XLSX was rejected
      const csvBlob = createCsvBlob(records);
      const csvName = fileData.filename.replace(/\.xlsx$/, '.csv');
      const csvFile = new File([csvBlob], csvName, {
        type: 'text/csv',
        lastModified: Date.now()
      });

      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [csvFile] })) {
        await navigator.share({
          files: [csvFile]
        });
        setIsSharing(false);
        return;
      }

      throw new Error('Direct file sharing is restricted by your browser.');
    } catch (err) {
      setIsSharing(false);
      if (err.name === 'AbortError') {
        return;
      }
      console.warn('Native share blocked/failed:', err);
      setShareErr(
        'Direct app sharing was blocked by browser permissions. Use "Send to WhatsApp", "Download File", or "Copy Records" below!'
      );
    }
  };

  // 2. Direct WhatsApp message
  const handleWhatsAppShare = () => {
    const text = formatRecordsForWhatsApp(records);
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // 3. Direct Download
  const handleDownload = () => {
    try {
      const url = URL.createObjectURL(fileData.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileData.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 3500);
    } catch (e) {
      console.error('Download failed:', e);
    }
  };

  // 4. Copy records table to clipboard
  const handleCopy = async () => {
    try {
      const text = formatRecordsForClipboard(records);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (e) {
      console.warn('Clipboard write failed:', e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-gray-900 rounded-3xl w-full max-w-md shadow-2xl border border-gray-700 p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-950/80 border border-emerald-600/50 flex items-center justify-center text-2xl">
              📤
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Share Scanned Records</h2>
              <p className="text-gray-400 text-xs font-mono truncate max-w-[210px] sm:max-w-xs">
                {fileData.filename}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none px-2 py-1"
          >
            ✕
          </button>
        </div>

        {/* Stats chip */}
        <div className="flex items-center gap-2 bg-gray-800/80 border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-300">
          <span>📊 {totalCount} total entries</span>
          <span className="text-gray-500">•</span>
          <span className="text-emerald-400 font-semibold">{completeCount} complete pairs</span>
          <span className="text-gray-500">•</span>
          <span>Excel (.xlsx)</span>
        </div>

        {/* Permission Notice */}
        {shareErr && (
          <div className="bg-amber-950/70 border border-amber-600/80 rounded-2xl p-3.5 text-xs text-amber-200 leading-relaxed shadow-md">
            <div className="flex items-center gap-1.5 font-bold text-amber-100 mb-1">
              <span>⚠️</span> Note on Browser Permissions
            </div>
            {shareErr}
          </div>
        )}

        {/* Action Options */}
        <div className="flex flex-col gap-2.5 mt-1">

          {/* 1. Native Share */}
          <button
            onClick={handleNativeShare}
            disabled={isSharing}
            className="w-full bg-emerald-700 hover:bg-emerald-600 text-white font-semibold py-3.5 px-4 rounded-2xl flex items-center justify-between transition-all shadow-md active:scale-98 disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">📲</span>
              <div className="text-left">
                <div className="text-sm font-bold">Share to Other Apps</div>
                <div className="text-[11px] text-emerald-200">WhatsApp, Drive, Email, Bluetooth</div>
              </div>
            </div>
            <span className="text-emerald-200 text-xs">➔</span>
          </button>

          {/* 2. WhatsApp List */}
          <button
            onClick={handleWhatsAppShare}
            className="w-full bg-green-800/90 hover:bg-green-700 text-white font-semibold py-3.5 px-4 rounded-2xl flex items-center justify-between border border-green-600/50 transition-all shadow-md active:scale-98"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">💬</span>
              <div className="text-left">
                <div className="text-sm font-bold">Send List to WhatsApp</div>
                <div className="text-[11px] text-green-200">Instant formatted text to any chat or group</div>
              </div>
            </div>
            <span className="text-green-200 text-xs">➔</span>
          </button>

          {/* 3. Download */}
          <button
            onClick={handleDownload}
            className="w-full bg-blue-800/90 hover:bg-blue-700 text-white font-semibold py-3.5 px-4 rounded-2xl flex items-center justify-between border border-blue-600/50 transition-all shadow-md active:scale-98"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">📥</span>
              <div className="text-left">
                <div className="text-sm font-bold">
                  {downloaded ? '✅ Saved to Downloads!' : 'Download Excel File'}
                </div>
                <div className="text-[11px] text-blue-200">Save directly to your device storage</div>
              </div>
            </div>
            <span className="text-blue-200 text-xs">{downloaded ? '✓' : '➔'}</span>
          </button>

          {/* 4. Copy to Clipboard */}
          <button
            onClick={handleCopy}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 px-4 rounded-2xl flex items-center justify-between border border-gray-700 transition-all active:scale-98"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">📋</span>
              <div className="text-left">
                <div className="text-sm font-bold">
                  {copied ? '✅ Copied to Clipboard!' : 'Copy Records Table'}
                </div>
                <div className="text-[11px] text-gray-400">Paste directly into notes, chat, or spreadsheets</div>
              </div>
            </div>
            <span className="text-gray-400 text-xs">{copied ? '✓' : '➔'}</span>
          </button>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-full bg-gray-800/80 hover:bg-gray-700 text-gray-300 font-medium py-3 rounded-2xl text-sm transition-colors mt-1"
        >
          Done
        </button>

      </div>
    </div>
  );
}

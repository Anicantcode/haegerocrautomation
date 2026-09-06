import { useState } from 'react';
import {
  formatRecordsForClipboard,
  formatRecordsForWhatsApp,
  createCsvFile,
} from '../export/excelExporter.js';

export function ShareModal({ isOpen, onClose, fileData, records }) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [shareErr, setShareErr] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  if (!isOpen || !fileData) return null;

  const totalCount = records?.length || 0;
  const completeCount = records?.filter(r => r.status === 'COMPLETE').length || 0;

  // 1. Direct Share Spreadsheet File to WhatsApp / Other Apps
  const handleShareSpreadsheet = async () => {
    setIsSharing(true);
    setShareErr('');
    try {
      // Chromium on Android strictly blocks .xlsx files via Web Share API (throws Permission Denied).
      // .csv is officially whitelisted in Chromium and opens directly in Excel, Google Sheets, & WhatsApp as a spreadsheet document.
      // iOS Safari allows .xlsx files.
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
      let fileToShare;

      if (isIOS && fileData?.file) {
        fileToShare = fileData.file;
      } else {
        const csv = createCsvFile(records);
        fileToShare = csv.file;
      }

      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [fileToShare] })) {
        await navigator.share({
          files: [fileToShare],
          title: fileToShare.name,
        });
        setIsSharing(false);
        return;
      }

      // If Web Share API is not supported on this device/browser (e.g. desktop PC)
      handleDownload();
      setShareErr('Spreadsheet file saved to Downloads! You can attach it via WhatsApp or email.');
    } catch (err) {
      if (err.name === 'AbortError') {
        // User cancelled / dismissed the native share sheet
        setIsSharing(false);
        return;
      }
      console.warn('Share failed:', err);
      // Fallback: download the file
      handleDownload();
      setShareErr(
        `Direct share restricted by browser (${err.message || 'Permission Denied'}). File saved to your Downloads!`
      );
    } finally {
      setIsSharing(false);
    }
  };

  // 2. Direct Download of .xlsx Workbook
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

  // 3. Share formatted WhatsApp Text Summary
  const handleWhatsAppText = () => {
    try {
      const text = formatRecordsForWhatsApp(records);
      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
    } catch (e) {
      console.error('WhatsApp text share failed:', e);
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
              📊
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Share Spreadsheet</h2>
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
          <span className="text-emerald-400 font-semibold">{completeCount} complete</span>
          <span className="text-gray-500">•</span>
          <span>Excel Compatible</span>
        </div>

        {/* Note / Guidance Notice if any error occurs */}
        {shareErr && (
          <div className="bg-amber-950/80 border border-amber-600 rounded-2xl p-3.5 text-xs text-amber-200 leading-relaxed shadow-md">
            <div className="flex items-center gap-1.5 font-bold text-amber-100 mb-1">
              <span>⚠️</span> Notice
            </div>
            {shareErr}
          </div>
        )}

        {/* Action Options */}
        <div className="flex flex-col gap-2.5 mt-1">

          {/* 1. Primary: Share Spreadsheet File (.csv) directly to WhatsApp & other apps */}
          <button
            onClick={handleShareSpreadsheet}
            disabled={isSharing}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-4 rounded-2xl flex items-center justify-between transition-all shadow-xl active:scale-98 disabled:opacity-50 border border-emerald-400/30"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📤</span>
              <div className="text-left">
                <div className="text-base font-bold flex items-center gap-1.5 flex-wrap">
                  <span>Share Spreadsheet File</span>
                  <span className="bg-emerald-800/90 text-emerald-200 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/50">
                    WhatsApp &amp; Apps
                  </span>
                </div>
                <div className="text-xs text-emerald-100 mt-0.5">
                  Sends file directly · Opens in Excel &amp; Sheets
                </div>
              </div>
            </div>
            <span className="text-emerald-200 text-sm font-bold">➔</span>
          </button>

          {/* 2. Download .xlsx File */}
          <button
            onClick={handleDownload}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 px-4 rounded-2xl flex items-center justify-between border border-gray-700 transition-all shadow-md active:scale-98"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">📥</span>
              <div className="text-left">
                <div className="text-sm font-bold">
                  {downloaded ? '✅ Saved to Downloads!' : 'Download Excel File (.xlsx)'}
                </div>
                <div className="text-[11px] text-gray-400">Save full .xlsx workbook to phone storage</div>
              </div>
            </div>
            <span className="text-gray-400 text-xs">{downloaded ? '✓' : '➔'}</span>
          </button>

          {/* 3. Send Text Report to WhatsApp */}
          <button
            onClick={handleWhatsAppText}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 px-4 rounded-2xl flex items-center justify-between border border-gray-700 transition-all active:scale-98"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">💬</span>
              <div className="text-left">
                <div className="text-sm font-bold">Send Summary on WhatsApp</div>
                <div className="text-[11px] text-gray-400">Send formatted text message with all records</div>
              </div>
            </div>
            <span className="text-gray-400 text-xs">➔</span>
          </button>

          {/* 4. Copy Table */}
          <button
            onClick={handleCopy}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 px-4 rounded-2xl flex items-center justify-between border border-gray-700 transition-all active:scale-98"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">📋</span>
              <div className="text-left">
                <div className="text-sm font-bold">
                  {copied ? '✅ Copied to Clipboard!' : 'Copy Numbers to Clipboard'}
                </div>
                <div className="text-[11px] text-gray-400">Copy table text to paste into notes or spreadsheets</div>
              </div>
            </div>
            <span className="text-gray-400 text-xs">{copied ? '✓' : '➔'}</span>
          </button>
        </div>

        {/* Tip for sending .xlsx via WhatsApp */}
        <div className="bg-gray-800/60 border border-gray-700/70 rounded-2xl p-3 text-xs text-gray-300">
          <div className="flex items-center justify-between font-bold text-white mb-1">
            <span className="flex items-center gap-1.5">
              <span>💡</span> Need to send .xlsx on WhatsApp?
            </span>
            <a
              href="whatsapp://send"
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold underline"
            >
              Open WhatsApp
            </a>
          </div>
          <p className="text-gray-400 text-[11px] leading-relaxed">
            1. Tap <strong className="text-gray-200">Download Excel File</strong> above.<br />
            2. In WhatsApp, tap <strong className="text-gray-200">📎 (Paperclip) → Document</strong> and select the downloaded file.
          </p>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-full bg-gray-800/80 hover:bg-gray-700 text-gray-300 font-medium py-3 rounded-2xl text-sm transition-colors mt-0.5"
        >
          Done
        </button>

      </div>
    </div>
  );
}

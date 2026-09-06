import { useState } from 'react';
import { useApp, getStats, ACTIONS } from '../context/AppContext.jsx';
import { ClearSessionDialog } from './ClearSessionDialog.jsx';
import { ShareModal } from './ShareModal.jsx';
import { exportToExcel, createExcelFile } from '../export/excelExporter.js';

export function HomeScreen({ onNavigate }) {
  const { state, dispatch } = useApp();
  const stats = getStats(state.records);
  const [showClear,      setShowClear]      = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [exportMsg,      setExportMsg]      = useState('');
  const [lastExported,   setLastExported]   = useState(null);

  const handleExport = () => {
    try {
      if (state.records.length === 0) {
        setExportMsg('❌ No records to export.');
        setTimeout(() => setExportMsg(''), 3000);
        return;
      }
      const fileData = exportToExcel(state.records);
      setLastExported(fileData);
      setExportMsg(`✅ File ready: ${fileData.filename}`);
      setTimeout(() => setExportMsg(''), 6000);
    } catch (err) {
      setExportMsg(`❌ ${err.message}`);
      setTimeout(() => setExportMsg(''), 4000);
    }
  };

  const handleShare = () => {
    if (state.records.length === 0) return;
    const fileData = createExcelFile(state.records);
    setLastExported(fileData);
    setShowShareModal(true);
  };

  const handleClear = () => {
    dispatch({ type: ACTIONS.CLEAR_SESSION });
    setLastExported(null);
    setShowShareModal(false);
    setShowClear(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">📄 Invoice &amp; Docket Scanner</h1>
          <p className="text-gray-400 text-xs mt-0.5">Scan · Pair · Export</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-emerald-950/80 border-emerald-700/60 text-emerald-300">
          <span>⚡</span>
          <span>Offline Ready</span>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 px-4 py-4">
        <div className="stat-card">
          <p className="text-gray-400 text-xs uppercase tracking-wide">Invoices</p>
          <p className="text-blue-400 text-3xl font-bold">{stats.invoiceCount}</p>
        </div>
        <div className="stat-card">
          <p className="text-gray-400 text-xs uppercase tracking-wide">Dockets</p>
          <p className="text-purple-400 text-3xl font-bold">{stats.docketCount}</p>
        </div>
        <div className="stat-card">
          <p className="text-gray-400 text-xs uppercase tracking-wide">Complete Pairs</p>
          <p className="text-green-400 text-3xl font-bold">{stats.complete}</p>
        </div>
        <div className="stat-card">
          <p className="text-gray-400 text-xs uppercase tracking-wide">Pending</p>
          <p className="text-yellow-400 text-3xl font-bold">{stats.total - stats.complete}</p>
        </div>
      </div>

      {/* Main Actions */}
      <div className="flex flex-col gap-3 px-4 py-2 flex-1">
        <button className="btn-primary bg-blue-700 hover:bg-blue-600" onClick={() => onNavigate('scan-invoice')}>
          <span className="text-2xl">🧾</span>
          <span>Scan Invoice</span>
          <span className="ml-auto text-blue-300 text-sm">Extract DN No.</span>
        </button>

        <button className="btn-primary bg-purple-700 hover:bg-purple-600" onClick={() => onNavigate('scan-docket')}>
          <span className="text-2xl">📦</span>
          <span>Scan Docket</span>
          <span className="ml-auto text-purple-300 text-sm">Extract Consignment No.</span>
        </button>

        <button className="btn-secondary" onClick={() => onNavigate('records')}>
          <span className="text-2xl">📋</span>
          <span>View Records</span>
          <span className="ml-auto text-gray-400 text-sm">{stats.total} rows</span>
        </button>

        <button
          className="btn-primary bg-green-700 hover:bg-green-600"
          onClick={handleExport}
          disabled={state.records.length === 0}
        >
          <span className="text-2xl">📊</span>
          <span>Export to Excel</span>
        </button>

        {/* Share File Button (appears below Export to Excel after file is made) */}
        {lastExported && (
          <button
            className="btn-primary bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl border border-emerald-400/40 active:scale-98 transition-all"
            onClick={handleShare}
          >
            <span className="text-2xl">📤</span>
            <span>Share File</span>
            <span className="ml-auto text-emerald-100 text-xs truncate max-w-[130px] font-mono">
              {lastExported.filename}
            </span>
          </button>
        )}

        {exportMsg && (
          <div className="bg-gray-800 rounded-xl px-4 py-3 text-sm text-center text-gray-200 border border-gray-700">
            {exportMsg}
          </div>
        )}

        <button
          className="btn-secondary border border-red-900 text-red-400 mt-2"
          onClick={() => setShowClear(true)}
          disabled={state.records.length === 0}
        >
          <span className="text-xl">🗑️</span>
          <span>Clear Session</span>
        </button>
      </div>



      {showClear && (
        <ClearSessionDialog onConfirm={handleClear} onCancel={() => setShowClear(false)} />
      )}

      {showShareModal && lastExported && (
        <ShareModal
          isOpen={showShareModal}
          fileData={lastExported}
          records={state.records}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}

import { useState } from 'react';
import { useApp, getInventoryStats, ACTIONS } from '../context/AppContext.jsx';
import { ClearSessionDialog } from './ClearSessionDialog.jsx';
import { ShareModal } from './ShareModal.jsx';
import { exportInventoryToExcel, createInventoryExcelFile } from '../export/excelExporter.js';

export function InventoryHomeScreen({ onNavigate, onBack }) {
  const { state, dispatch } = useApp();
  const records = state.inventory?.records || [];
  const stats = getInventoryStats(records);
  const [showClear,      setShowClear]      = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [exportMsg,      setExportMsg]      = useState('');
  const [lastExported,   setLastExported]   = useState(null);

  const handleExport = () => {
    try {
      if (records.length === 0) {
        setExportMsg('❌ No inventory records to export.');
        setTimeout(() => setExportMsg(''), 3000);
        return;
      }
      const fileData = exportInventoryToExcel(records);
      setLastExported(fileData);
      setExportMsg(`✅ File ready: ${fileData.filename}`);
      setTimeout(() => setExportMsg(''), 6000);
    } catch (err) {
      setExportMsg(`❌ ${err.message}`);
      setTimeout(() => setExportMsg(''), 4000);
    }
  };

  const handleShare = () => {
    if (records.length === 0) return;
    const fileData = createInventoryExcelFile(records);
    setLastExported(fileData);
    setShowShareModal(true);
  };

  const handleClear = () => {
    dispatch({ type: ACTIONS.CLEAR_INVENTORY_SESSION });
    setLastExported(null);
    setShowShareModal(false);
    setShowClear(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-4 flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-white text-2xl leading-none px-1"
            title="Back to Modules"
          >
            ←
          </button>
        )}
        <h1 className="text-xl font-bold text-white">📦 Inventory Scanner</h1>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 px-4 py-4">
        <div className="stat-card">
          <p className="text-gray-400 text-xs uppercase tracking-wide">Materials</p>
          <p className="text-cyan-400 text-3xl font-bold">{stats.materialCount}</p>
        </div>
        <div className="stat-card">
          <p className="text-gray-400 text-xs uppercase tracking-wide">Bins</p>
          <p className="text-purple-400 text-3xl font-bold">{stats.binCount}</p>
        </div>
        <div className="stat-card">
          <p className="text-gray-400 text-xs uppercase tracking-wide">Complete Pairs</p>
          <p className="text-green-400 text-3xl font-bold">{stats.complete}</p>
        </div>
        <div className="stat-card">
          <p className="text-gray-400 text-xs uppercase tracking-wide">Pending</p>
          <p className="text-yellow-400 text-3xl font-bold">{stats.pendingBin + stats.pendingMaterial}</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 px-4 pb-6 flex-1">
        <button className="btn-primary bg-cyan-700 hover:bg-cyan-600" onClick={() => onNavigate('scan-material')}>
          <span className="text-2xl">🏷️</span>
          <span>Scan Material</span>
          <span className="ml-auto text-cyan-200 text-sm">Extract Material Code</span>
        </button>

        <button className="btn-primary bg-purple-700 hover:bg-purple-600" onClick={() => onNavigate('scan-bin')}>
          <span className="text-2xl">📍</span>
          <span>Scan Bin</span>
          <span className="ml-auto text-purple-200 text-sm">Extract Bin Location</span>
        </button>

        <button className="btn-secondary" onClick={() => onNavigate('records')}>
          <span className="text-2xl">📋</span>
          <span>View Records</span>
          <span className="ml-auto text-gray-400 text-sm">{stats.total} rows</span>
        </button>

        <button
          className="btn-primary bg-green-700 hover:bg-green-600"
          onClick={handleExport}
          disabled={records.length === 0}
        >
          <span className="text-2xl">📊</span>
          <span>Export to Excel</span>
        </button>

        {/* Share File Button */}
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
          disabled={records.length === 0}
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
          records={records}
          module="inventory"
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}

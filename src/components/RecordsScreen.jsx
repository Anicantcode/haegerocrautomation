import { useState } from 'react';
import { useApp, ACTIONS } from '../context/AppContext.jsx';
import { EditRecordModal } from './EditRecordModal.jsx';

const STATUS_BADGE = {
  COMPLETE:       { label: '✓ Complete',        cls: 'bg-green-900/80 border border-green-700 text-green-300' },
  PENDING_DOCKET: { label: '⏳ Need Docket',    cls: 'bg-yellow-900/80 border border-yellow-700 text-yellow-300' },
  PENDING_INVOICE:{ label: '⏳ Need Invoice',   cls: 'bg-orange-900/80 border border-orange-700 text-orange-300' },
};

export function RecordsScreen({ onBack }) {
  const { state, dispatch } = useApp();
  const [editingRecord, setEditingRecord] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const records = state.records;

  const handleDeleteConfirm = (id) => {
    dispatch({ type: ACTIONS.DELETE_RECORD, payload: id });
    setDeleteConfirmId(null);
  };

  const handleEditSave = (updated) => {
    dispatch({ type: ACTIONS.UPDATE_RECORD, payload: updated });
    setEditingRecord(null);
  };

  const handleQuickUpdate = (id, field, value) => {
    dispatch({ type: ACTIONS.UPDATE_RECORD, payload: { id, [field]: value } });
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 py-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-white text-2xl leading-none px-1"
          >
            ←
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Records</h1>
            <p className="text-gray-400 text-xs">
              {records.length} total · {records.filter(r => r.status === 'COMPLETE').length} complete
            </p>
          </div>
        </div>
      </header>

      {records.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-600 gap-3 p-6">
          <span className="text-6xl">📭</span>
          <p className="text-lg text-gray-400 font-semibold">No records yet</p>
          <p className="text-sm text-gray-500 text-center">Start scanning invoices and dockets to see them listed here.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* Desktop & Tablet Full Table (with inline quick edit) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 text-gray-400 uppercase text-[11px] tracking-wider sticky top-0 z-10 border-b border-gray-800">
                <tr>
                  <th className="px-3 py-3 text-left w-10">#</th>
                  <th className="px-3 py-3 text-left">DN No.</th>
                  <th className="px-3 py-3 text-left">Docket No.</th>
                  <th className="px-3 py-3 text-left w-24">📦 Boxes</th>
                  <th className="px-3 py-3 text-left w-28">⚖️ Weight</th>
                  <th className="px-3 py-3 text-left w-44">🚚 Transporter</th>
                  <th className="px-3 py-3 text-left">Status</th>
                  <th className="px-3 py-3 text-center w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {records.map((r, idx) => {
                  const badge = STATUS_BADGE[r.status] || STATUS_BADGE.COMPLETE;
                  return (
                    <tr key={r.id} className="hover:bg-gray-900/50 transition-colors">
                      <td className="px-3 py-3 text-gray-500 font-mono text-xs">{idx + 1}</td>
                      <td className="px-3 py-3 font-mono font-bold text-cyan-300">{r.dnNumber || '—'}</td>
                      <td className="px-3 py-3 font-mono font-bold text-fuchsia-300">{r.docketNumber || '—'}</td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          placeholder="Boxes"
                          value={r.boxes || ''}
                          onChange={(e) => handleQuickUpdate(r.id, 'boxes', e.target.value)}
                          className="w-20 bg-gray-900 border border-gray-700/80 rounded-lg px-2 py-1 text-xs text-white placeholder-gray-600 focus:border-cyan-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          placeholder="Weight"
                          value={r.weight || ''}
                          onChange={(e) => handleQuickUpdate(r.id, 'weight', e.target.value)}
                          className="w-24 bg-gray-900 border border-gray-700/80 rounded-lg px-2 py-1 text-xs text-white placeholder-gray-600 focus:border-cyan-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          placeholder="Transporter"
                          value={r.transporter || ''}
                          onChange={(e) => handleQuickUpdate(r.id, 'transporter', e.target.value)}
                          className="w-40 bg-gray-900 border border-gray-700/80 rounded-lg px-2 py-1 text-xs text-white placeholder-gray-600 focus:border-cyan-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setEditingRecord(r)}
                            className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                            title="Edit all record details"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(r.id)}
                            className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                            title="Delete record"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="md:hidden flex flex-col gap-3 p-4">
            {records.map((r, idx) => {
              const badge = STATUS_BADGE[r.status] || STATUS_BADGE.COMPLETE;
              return (
                <div key={r.id} className="bg-gray-900/90 border border-gray-800 rounded-2xl p-4 shadow-lg flex flex-col gap-3">
                  {/* Top row: # and status badge */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 font-bold text-sm">#{idx + 1}</span>
                    <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>

                  {/* Numbers Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-950 p-2.5 rounded-xl border border-gray-800/80">
                      <p className="text-gray-500 text-[10px] font-semibold uppercase">🧾 DN No.</p>
                      <p className="text-cyan-300 font-mono font-bold text-base truncate mt-0.5">
                        {r.dnNumber || '—'}
                      </p>
                    </div>
                    <div className="bg-gray-950 p-2.5 rounded-xl border border-gray-800/80">
                      <p className="text-gray-500 text-[10px] font-semibold uppercase">📦 Docket No.</p>
                      <p className="text-fuchsia-300 font-mono font-bold text-base truncate mt-0.5">
                        {r.docketNumber || '—'}
                      </p>
                    </div>
                  </div>

                  {/* Logistics details: Boxes, Weight, Transporter */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-gray-950/80 p-2 rounded-xl border border-gray-800/60">
                      <p className="text-gray-500 text-[10px] font-medium">📦 Boxes</p>
                      <p className="text-white font-semibold truncate mt-0.5">{r.boxes || '—'}</p>
                    </div>
                    <div className="bg-gray-950/80 p-2 rounded-xl border border-gray-800/60">
                      <p className="text-gray-500 text-[10px] font-medium">⚖️ Weight</p>
                      <p className="text-white font-semibold truncate mt-0.5">{r.weight || '—'}</p>
                    </div>
                    <div className="bg-gray-950/80 p-2 rounded-xl border border-gray-800/60">
                      <p className="text-gray-500 text-[10px] font-medium">🚚 Transporter</p>
                      <p className="text-white font-semibold truncate mt-0.5">{r.transporter || '—'}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1 border-t border-gray-800/60">
                    <button
                      onClick={() => setEditingRecord(r)}
                      className="flex-1 bg-blue-950/60 hover:bg-blue-900/80 border border-blue-800/60 text-blue-300 font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span>✏️</span> Edit Details
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(r.id)}
                      className="bg-red-950/60 hover:bg-red-900/80 border border-red-900/60 text-red-300 px-3.5 py-2.5 rounded-xl text-xs transition-colors"
                      title="Delete record"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-xs shadow-2xl border border-red-900/80">
            <h2 className="text-white font-bold text-lg text-center mb-1">Delete Record?</h2>
            <p className="text-gray-400 text-xs text-center mb-5">This row will be permanently removed.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteConfirm(deleteConfirmId)}
                className="flex-1 bg-red-700 hover:bg-red-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit full record modal */}
      {editingRecord && (
        <EditRecordModal
          record={editingRecord}
          onSave={handleEditSave}
          onClose={() => setEditingRecord(null)}
        />
      )}
    </div>
  );
}

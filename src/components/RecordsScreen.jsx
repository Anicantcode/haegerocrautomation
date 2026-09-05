import { useState } from 'react';
import { useApp, ACTIONS } from '../context/AppContext.jsx';
import { ManualEntryDialog } from './ManualEntryDialog.jsx';

const STATUS_BADGE = {
  COMPLETE:       { label: '✓ Complete',        cls: 'bg-green-900 text-green-300' },
  PENDING_DOCKET: { label: '⏳ Need Docket',    cls: 'bg-yellow-900 text-yellow-300' },
  PENDING_INVOICE:{ label: '⏳ Need Invoice',   cls: 'bg-orange-900 text-orange-300' },
};

export function RecordsScreen({ onBack }) {
  const { state, dispatch } = useApp();
  const [editingRecord, setEditingRecord] = useState(null);  // { id, field: 'dn'|'docket' }
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const records = state.records;

  const handleDeleteConfirm = (id) => {
    dispatch({ type: ACTIONS.DELETE_RECORD, payload: id });
    setDeleteConfirmId(null);
  };

  const handleEditSave = (value) => {
    if (!editingRecord) return;
    const update = { id: editingRecord.id };
    if (editingRecord.field === 'dn')     update.dnNumber = value;
    else                                   update.docketNumber = value;
    dispatch({ type: ACTIONS.UPDATE_RECORD, payload: update });
    setEditingRecord(null);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 flex items-center gap-3 px-4 py-4">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white text-2xl leading-none"
        >
          ←
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Records</h1>
          <p className="text-gray-400 text-xs">{records.length} total · {records.filter(r => r.status === 'COMPLETE').length} complete</p>
        </div>
      </header>

      {records.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-600 gap-3">
          <span className="text-6xl">📭</span>
          <p className="text-lg">No records yet</p>
          <p className="text-sm">Start scanning to see records here</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* Desktop table / mobile cards */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 text-gray-400 uppercase text-xs tracking-wide sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left w-12">#</th>
                  <th className="px-4 py-3 text-left">DN No.</th>
                  <th className="px-4 py-3 text-left">Docket No.</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, idx) => {
                  const badge = STATUS_BADGE[r.status];
                  return (
                    <tr key={r.id} className="border-b border-gray-800 hover:bg-gray-900/50">
                      <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                      <td className="px-4 py-3 font-mono text-blue-300">{r.dnNumber || '—'}</td>
                      <td className="px-4 py-3 font-mono text-purple-300">{r.docketNumber || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setEditingRecord({ id: r.id, field: 'dn' })}
                            className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-gray-800"
                            title="Edit DN No."
                          >✏️ DN</button>
                          <button
                            onClick={() => setEditingRecord({ id: r.id, field: 'docket' })}
                            className="text-xs text-purple-400 hover:text-purple-300 px-2 py-1 rounded hover:bg-gray-800"
                            title="Edit Docket No."
                          >✏️ Docket</button>
                          <button
                            onClick={() => setDeleteConfirmId(r.id)}
                            className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-gray-800"
                          >🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden flex flex-col gap-3 p-4">
            {records.map((r, idx) => {
              const badge = STATUS_BADGE[r.status];
              return (
                <div key={r.id} className="card">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-500 text-sm">#{idx + 1}</span>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
                  </div>
                  <div className="space-y-2 mb-3">
                    <div>
                      <p className="text-gray-500 text-xs">DN No.</p>
                      <p className="text-blue-300 font-mono text-lg">{r.dnNumber || '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Docket No.</p>
                      <p className="text-purple-300 font-mono text-lg">{r.docketNumber || '—'}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingRecord({ id: r.id, field: 'dn' })}
                      className="flex-1 text-sm text-blue-400 border border-blue-900 hover:bg-blue-900/30 py-2 rounded-lg"
                    >✏️ Edit DN</button>
                    <button
                      onClick={() => setEditingRecord({ id: r.id, field: 'docket' })}
                      className="flex-1 text-sm text-purple-400 border border-purple-900 hover:bg-purple-900/30 py-2 rounded-lg"
                    >✏️ Edit Docket</button>
                    <button
                      onClick={() => setDeleteConfirmId(r.id)}
                      className="text-sm text-red-400 border border-red-900 hover:bg-red-900/30 py-2 px-3 rounded-lg"
                    >🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-xs shadow-2xl border border-red-900">
            <h2 className="text-white font-bold text-lg text-center mb-2">Delete Record?</h2>
            <p className="text-gray-400 text-sm text-center mb-5">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-xl"
              >Cancel</button>
              <button
                onClick={() => handleDeleteConfirm(deleteConfirmId)}
                className="flex-1 bg-red-700 hover:bg-red-600 text-white font-semibold py-3 rounded-xl"
              >Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit dialog */}
      {editingRecord && (
        <ManualEntryDialog
          mode={editingRecord.field === 'dn' ? 'invoice' : 'docket'}
          initialValue={
            editingRecord.field === 'dn'
              ? (state.records.find(r => r.id === editingRecord.id)?.dnNumber || '')
              : (state.records.find(r => r.id === editingRecord.id)?.docketNumber || '')
          }
          onConfirm={handleEditSave}
          onCancel={() => setEditingRecord(null)}
        />
      )}
    </div>
  );
}

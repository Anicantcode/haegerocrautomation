import { useState } from 'react';

export function EditInventoryRecordModal({ record, onSave, onClose }) {
  const [material, setMaterial] = useState(record.material || '');
  const [bin, setBin]           = useState(record.bin || '');
  const [quantity, setQuantity] = useState(record.quantity || '');
  const [year, setYear]         = useState(record.year || '');
  const [remark, setRemark]     = useState(record.remark || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      id: record.id,
      material: material.trim(),
      bin: bin.trim(),
      quantity: quantity.trim(),
      year: year.trim(),
      remark: remark.trim(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-700 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">✏️</span>
            <h2 className="text-white text-lg font-bold">Edit Record #{record.id}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Material */}
          <div>
            <label className="block text-gray-400 text-xs font-semibold uppercase mb-1">
              🏷️ Material
            </label>
            <input
              type="text"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder="e.g. MAT-100234"
              className="w-full bg-gray-800 border border-gray-700 focus:border-cyan-500 outline-none text-cyan-300 font-mono text-sm rounded-xl px-3.5 py-2.5"
            />
          </div>

          {/* Bin */}
          <div>
            <label className="block text-gray-400 text-xs font-semibold uppercase mb-1">
              📍 Bin
            </label>
            <input
              type="text"
              value={bin}
              onChange={(e) => setBin(e.target.value)}
              placeholder="e.g. A-12-04"
              className="w-full bg-gray-800 border border-gray-700 focus:border-fuchsia-500 outline-none text-fuchsia-300 font-mono text-sm rounded-xl px-3.5 py-2.5"
            />
          </div>

          {/* Quantity & Year */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-400 text-xs font-semibold uppercase mb-1">
                🔢 Quantity
              </label>
              <input
                type="text"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 50"
                className="w-full bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none text-white text-sm rounded-xl px-3.5 py-2.5"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs font-semibold uppercase mb-1">
                📅 Year
              </label>
              <input
                type="text"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="e.g. 2024"
                className="w-full bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none text-white text-sm rounded-xl px-3.5 py-2.5"
              />
            </div>
          </div>

          {/* Remark */}
          <div>
            <label className="block text-gray-400 text-xs font-semibold uppercase mb-1">
              📝 Remark
            </label>
            <input
              type="text"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="e.g. Verified count, Good condition"
              className="w-full bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none text-white text-sm rounded-xl px-3.5 py-2.5"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-colors shadow-lg text-sm"
            >
              ✓ Save Details
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

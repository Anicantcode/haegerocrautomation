import { useState } from 'react';

export function EditRecordModal({ record, onSave, onClose }) {
  const [dnNumber, setDnNumber]       = useState(record.dnNumber || '');
  const [docketNumber, setDocketNumber] = useState(record.docketNumber || '');
  const [boxes, setBoxes]             = useState(record.boxes || '');
  const [weight, setWeight]           = useState(record.weight || '');
  const [transporter, setTransporter] = useState(record.transporter || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      id: record.id,
      dnNumber: dnNumber.trim(),
      docketNumber: docketNumber.trim(),
      boxes: boxes.trim(),
      weight: weight.trim(),
      transporter: transporter.trim(),
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
          {/* DN No. */}
          <div>
            <label className="block text-gray-400 text-xs font-semibold uppercase mb-1">
              🧾 DN No. (Invoice)
            </label>
            <input
              type="text"
              value={dnNumber}
              onChange={(e) => setDnNumber(e.target.value)}
              placeholder="e.g. 2131537326"
              className="w-full bg-gray-800 border border-gray-700 focus:border-cyan-500 outline-none text-cyan-300 font-mono text-sm rounded-xl px-3.5 py-2.5"
            />
          </div>

          {/* Docket No. */}
          <div>
            <label className="block text-gray-400 text-xs font-semibold uppercase mb-1">
              📦 Docket / Consignment No.
            </label>
            <input
              type="text"
              value={docketNumber}
              onChange={(e) => setDocketNumber(e.target.value)}
              placeholder="e.g. 356953700227462"
              className="w-full bg-gray-800 border border-gray-700 focus:border-fuchsia-500 outline-none text-fuchsia-300 font-mono text-sm rounded-xl px-3.5 py-2.5"
            />
          </div>

          {/* Row for Boxes & Weight */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-400 text-xs font-semibold uppercase mb-1">
                📦 No. of Boxes
              </label>
              <input
                type="text"
                value={boxes}
                onChange={(e) => setBoxes(e.target.value)}
                placeholder="e.g. 5"
                className="w-full bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none text-white text-sm rounded-xl px-3.5 py-2.5"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs font-semibold uppercase mb-1">
                ⚖️ Weight
              </label>
              <input
                type="text"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="e.g. 12.5 kg"
                className="w-full bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none text-white text-sm rounded-xl px-3.5 py-2.5"
              />
            </div>
          </div>

          {/* Transporter Name */}
          <div>
            <label className="block text-gray-400 text-xs font-semibold uppercase mb-1">
              🚚 Transporter Name
            </label>
            <input
              type="text"
              value={transporter}
              onChange={(e) => setTransporter(e.target.value)}
              placeholder="e.g. VRL Logistics, TCI Express, SafeXpress"
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

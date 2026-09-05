import { useState } from 'react';

export function ManualEntryDialog({ mode, initialValue = '', onConfirm, onCancel }) {
  const [value, setValue] = useState(initialValue);
  const label = mode === 'invoice' ? 'DN No.' : 'Consignment Note No.';
  const placeholder = mode === 'invoice' ? 'e.g. 2131537326' : 'e.g. 356953700227462';

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = value.trim().replace(/\s/g, '');
    if (trimmed) onConfirm(trimmed);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-gray-700">
        <div className="text-center mb-5">
          <div className="text-blue-400 text-4xl mb-3">✏️</div>
          <h2 className="text-white text-xl font-bold">Enter {label}</h2>
          <p className="text-gray-400 text-sm mt-1">Type the number manually</p>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9\s]*"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={placeholder}
            autoFocus
            className="w-full bg-gray-800 border border-gray-600 focus:border-blue-500 outline-none text-white text-xl font-mono rounded-xl px-4 py-3 mb-5 text-center tracking-wider"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!value.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

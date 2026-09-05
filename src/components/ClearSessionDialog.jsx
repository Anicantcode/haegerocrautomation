export function ClearSessionDialog({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-red-900">
        <div className="text-center mb-5">
          <div className="text-red-400 text-4xl mb-3">🗑️</div>
          <h2 className="text-white text-xl font-bold mb-2">Clear Session?</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            All currently scanned records will be removed.<br />
            <span className="text-yellow-400 font-semibold">Make sure you have exported the Excel file first.</span>
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-red-700 hover:bg-red-600 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  );
}

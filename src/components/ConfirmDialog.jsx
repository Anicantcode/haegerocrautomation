export function ConfirmDialog({ value, mode, onConfirm, onEdit, onRetry }) {
  const label = mode === 'invoice' ? 'DN No.' : 'Consignment Note No.';
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-gray-700">
        <div className="text-center mb-6">
          <div className="text-yellow-400 text-4xl mb-3">⚠️</div>
          <h2 className="text-white text-xl font-bold mb-1">Confirm {label}</h2>
          <p className="text-gray-400 text-sm">Low confidence — please verify</p>
        </div>

        <div className="bg-gray-800 rounded-xl p-4 mb-6 text-center">
          <p className="text-gray-400 text-sm mb-1">{label}</p>
          <p className="text-white text-3xl font-mono font-bold tracking-wider break-all">{value}</p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => onConfirm(value)}
            className="bg-green-600 hover:bg-green-500 text-white font-semibold py-3 px-6 rounded-xl text-lg transition-colors"
          >
            ✓ Confirm
          </button>
          <button
            onClick={() => onEdit(value)}
            className="bg-blue-700 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-xl text-lg transition-colors"
          >
            ✏️ Edit
          </button>
          <button
            onClick={onRetry}
            className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-xl text-lg transition-colors"
          >
            🔄 Retry Scan
          </button>
        </div>
      </div>
    </div>
  );
}

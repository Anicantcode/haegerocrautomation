import { useState } from 'react';

export function ModuleSelectorScreen({ onSelectModule }) {
  const [warehouseOpen, setWarehouseOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-4">
        <h1 className="text-xl font-bold text-white">Select Module</h1>
      </header>

      <div className="p-4 flex flex-col gap-4 flex-1">
        {/* Warehouse Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
          <button
            onClick={() => setWarehouseOpen(prev => !prev)}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-800/60 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏭</span>
              <div>
                <h2 className="text-white font-bold text-base">Warehouse</h2>
                <p className="text-gray-400 text-xs">Tap to view available operations</p>
              </div>
            </div>
            <span className="text-gray-400 text-sm font-bold">
              {warehouseOpen ? '▲' : '▼'}
            </span>
          </button>

          {/* Sub-options for Warehouse */}
          {warehouseOpen && (
            <div className="px-4 pb-4 pt-2 flex flex-col gap-3 border-t border-gray-800/80 bg-gray-950/40 animate-fade-in">
              {/* Dispatch */}
              <button
                onClick={() => onSelectModule('dispatch')}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-between transition-all active:scale-98 shadow-md"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🚚</span>
                  <div className="text-left">
                    <div className="text-sm font-bold">Dispatch</div>
                    <div className="text-xs text-blue-200">Scan Invoices (DN) &amp; Dockets</div>
                  </div>
                </div>
                <span className="text-blue-200 font-bold">➔</span>
              </button>

              {/* Inventory */}
              <button
                onClick={() => onSelectModule('inventory')}
                className="w-full bg-purple-700 hover:bg-purple-600 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-between transition-all active:scale-98 shadow-md"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📦</span>
                  <div className="text-left">
                    <div className="text-sm font-bold">Inventory</div>
                    <div className="text-xs text-purple-200">Scan Materials &amp; Bins</div>
                  </div>
                </div>
                <span className="text-purple-200 font-bold">➔</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

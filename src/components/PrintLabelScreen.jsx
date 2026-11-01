import { useState, useEffect } from 'react';
import { printerService } from '../printer/printerService.js';
import { generateBoxLabelTSPL } from '../printer/tsplGenerator.js';
import { BarcodeSvg } from '../printer/BarcodeSvg.jsx';
import { ScanDNModal } from './ScanDNModal.jsx';

export function PrintLabelScreen({ onBack }) {
  // Form State
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [dnNumber, setDnNumber] = useState('');
  const [boxNumber, setBoxNumber] = useState('');
  const [materials, setMaterials] = useState([
    { code: '', qty: '' },
  ]);
  const [copies, setCopies] = useState(1);

  // Scanner modal: null | { type: 'invoice' } | { type: 'name' } | { type: 'dn' } | { type: 'material', index: number | 'new' }
  const [scanTarget, setScanTarget] = useState(null);

  // Printer State
  const [printerState, setPrinterState] = useState(() => printerService.getState());
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);

  // Subscribe to printer connection updates
  useEffect(() => {
    return printerService.subscribe((state) => {
      setPrinterState(state);
    });
  }, []);

  const showNotification = (msg, duration = 4000) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), duration);
  };

  // Add / Remove / Edit Material Rows
  const handleAddMaterial = () => {
    setMaterials(prev => [...prev, { code: '', qty: '' }]);
  };

  const handleRemoveMaterial = (index) => {
    setMaterials(prev => prev.filter((_, i) => i !== index));
  };

  const handleMaterialChange = (index, field, value) => {
    setMaterials(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Handle scanned result from camera
  const handleScannedResult = (result) => {
    if (!scanTarget) return;

    if (scanTarget.type === 'invoice') {
      if (typeof result === 'object' && result !== null) {
        if (result.dnNumber) setDnNumber(result.dnNumber);
        if (result.name) setName(result.name);
        if (result.city) setCity(result.city);
        showNotification(`✅ Scanned Invoice: ${result.name ? `${result.name} | ` : ''}DN ${result.dnNumber || 'found'}`);
      } else if (typeof result === 'string') {
        setDnNumber(result);
        showNotification(`✅ Scanned DN: ${result}`);
      }
    } else if (scanTarget.type === 'name') {
      const text = typeof result === 'object' && result !== null ? (result.name || '') : String(result || '');
      if (text) {
        setName(text.toUpperCase());
        if (typeof result === 'object' && result.city && !city) {
          setCity(result.city.toUpperCase());
        }
        showNotification(`✅ Scanned Name: ${text}`);
      }
    } else if (scanTarget.type === 'dn') {
      const code = typeof result === 'object' && result !== null ? (result.dnNumber || '') : String(result || '');
      if (code) {
        setDnNumber(code);
        showNotification(`✅ Scanned DN: ${code}`);
      }
    } else if (scanTarget.type === 'material') {
      const code = typeof result === 'string' ? result : (result?.code || '');
      if (scanTarget.index === 'new') {
        // If the only row is empty, fill it; otherwise append a new row
        setMaterials((prev) => {
          if (prev.length === 1 && !prev[0].code.trim() && !prev[0].qty) {
            return [{ code, qty: '' }];
          }
          return [...prev, { code, qty: '' }];
        });
      } else {
        handleMaterialChange(scanTarget.index, 'code', code);
      }
      showNotification(`✅ Scanned Material: ${code}`);
    }
  };

  // Reset form for next carton
  const handleReset = () => {
    setName('');
    setCity('');
    setDnNumber('');
    setBoxNumber('');
    setMaterials([{ code: '', qty: '' }]);
    showNotification('Form cleared for next carton.');
  };

  // Connect to Printer
  const handleConnect = async (type) => {
    try {
      setShowConnectModal(false);
      if (type === 'serial') {
        await printerService.connectSerial();
        showNotification('✅ Printer connected!');
      } else if (type === 'bluetooth') {
        await printerService.connectBluetooth();
        showNotification('✅ Printer connected!');
      }
    } catch (err) {
      showNotification(`❌ Connection failed: ${err.message}`);
    }
  };

  const handleDisconnect = async () => {
    await printerService.disconnect();
    showNotification('Printer disconnected.');
  };

  // Print Label Handler
  const handlePrint = async () => {
    const cleanName = name.trim();
    const cleanCity = city.trim();
    const cleanDN = dnNumber.trim();

    if (!cleanName) {
      showNotification('⚠️ Please enter or scan Name first.');
      return;
    }

    if (!cleanCity) {
      showNotification('⚠️ Please enter City first.');
      return;
    }

    if (!cleanDN) {
      showNotification('⚠️ Please enter or scan a DN Number first.');
      return;
    }

    const validMaterials = materials.filter(m => m.code.trim() || m.qty.toString().trim());
    if (validMaterials.length === 0) {
      showNotification('⚠️ Please enter at least one material.');
      return;
    }

    setIsPrinting(true);

    if (printerState.isConnected) {
      try {
        const tspl = generateBoxLabelTSPL({
          name: cleanName,
          city: cleanCity,
          dnNumber: cleanDN,
          boxNumber: boxNumber.trim(),
          materials: validMaterials,
          copies,
        });

        await printerService.printDirect(tspl);
        showNotification(`✅ Printed ${copies} label(s)!`);
        handleReset();
      } catch (err) {
        showNotification(`❌ Print error: ${err.message}. Trying browser print...`);
        printerService.printBrowser();
      } finally {
        setIsPrinting(false);
      }
    } else {
      try {
        printerService.printBrowser();
        showNotification('🖨️ Opening print dialog...');
      } finally {
        setIsPrinting(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col text-gray-100">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3.5 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-white text-2xl leading-none px-1"
            title="Back"
          >
            ←
          </button>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <span>🏷️</span> Box Label Printing
            </h1>
          </div>
        </div>

        {/* Printer Connection Badge / Button */}
        <div>
          {printerState.isConnected ? (
            <button
              onClick={handleDisconnect}
              className="bg-emerald-950/80 border border-emerald-600/70 text-emerald-300 text-xs font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-emerald-900/90 transition-colors shadow-sm"
              title="Click to disconnect"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Connected</span>
            </button>
          ) : (
            <button
              onClick={() => setShowConnectModal(true)}
              className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 text-xs font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>Connect Printer</span>
            </button>
          )}
        </div>
      </header>

      {/* Notification Banner */}
      {statusMsg && (
        <div className="bg-blue-900/90 border-b border-blue-700 px-4 py-2 text-center text-xs font-medium text-blue-100 animate-fade-in">
          {statusMsg}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 max-w-lg mx-auto w-full">
        {/* Input Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 shadow-lg flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-bold text-sm tracking-wide uppercase text-gray-400 flex items-center gap-2">
              <span>📝</span> Label Details
            </h2>
            <button
              type="button"
              onClick={() => setScanTarget({ type: 'invoice' })}
              className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow"
              title="Scan invoice to extract DN, Name, and City automatically"
            >
              <span>📷</span>
              <span>Scan Invoice</span>
            </button>
          </div>

          {/* Name Field (Above DN No) */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Name <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.toUpperCase())}
                placeholder="e.g. ACME ENTERPRISES PVT LTD"
                className="flex-1 bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-white font-medium text-sm focus:outline-none focus:border-blue-500 transition-colors uppercase"
              />
              <button
                type="button"
                onClick={() => setScanTarget({ type: 'name' })}
                className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold px-3 py-2.5 rounded-xl text-sm flex items-center justify-center transition-colors shadow shrink-0"
                title="Scan customer name from document"
              >
                <span>📷</span>
              </button>
            </div>
          </div>

          {/* City Field (Below Name, Above DN No) */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              City <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value.toUpperCase())}
              placeholder="e.g. BANGALORE"
              className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-white font-medium text-sm focus:outline-none focus:border-blue-500 transition-colors uppercase"
            />
          </div>

          {/* DN Number with Scan Button */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              DN Number <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={dnNumber}
                onChange={(e) => setDnNumber(e.target.value.toUpperCase())}
                placeholder="e.g. 2134621450"
                className="flex-1 bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-white font-mono text-base focus:outline-none focus:border-blue-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setScanTarget({ type: 'dn' })}
                className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold px-3.5 py-2.5 rounded-xl text-sm flex items-center gap-1.5 transition-colors shadow"
                title="Scan barcode or invoice"
              >
                <span>📷</span>
                <span>Scan</span>
              </button>
            </div>
          </div>

          {/* Box Number */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Box Number
            </label>
            <input
              type="text"
              value={boxNumber}
              onChange={(e) => setBoxNumber(e.target.value)}
              placeholder="e.g. 3"
              className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2 text-white font-medium text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Materials & Quantities */}
          <div className="flex flex-col gap-2 pt-1 border-t border-gray-800/80">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-300">
                Materials in this Box
              </label>
              <button
                type="button"
                onClick={handleAddMaterial}
                className="text-blue-400 hover:text-blue-300 text-xs font-semibold py-1 px-2 rounded-lg hover:bg-blue-950/60 transition-colors"
              >
                + Add Material
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {materials.map((mat, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex-1 flex gap-1.5">
                    <input
                      type="text"
                      value={mat.code}
                      onChange={(e) => handleMaterialChange(idx, 'code', e.target.value.toUpperCase())}
                      placeholder="Material code"
                      className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setScanTarget({ type: 'material', index: idx })}
                      className="bg-blue-600/90 hover:bg-blue-500 active:bg-blue-700 text-white px-2.5 py-2 rounded-xl text-xs flex items-center justify-center transition-colors shadow shrink-0"
                      title="Scan barcode for this material"
                    >
                      📷
                    </button>
                  </div>
                  <input
                    type="number"
                    value={mat.qty}
                    onChange={(e) => handleMaterialChange(idx, 'qty', e.target.value)}
                    placeholder="Qty"
                    className="w-20 bg-gray-950 border border-gray-700 rounded-xl px-3 py-2 text-white font-mono text-sm text-center focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  {materials.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMaterial(idx)}
                      className="text-gray-500 hover:text-red-400 p-2 text-lg leading-none"
                      title="Remove row"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live Label Preview */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Live Preview
            </span>
          </div>

          <div className="bg-neutral-200 p-4 rounded-2xl flex items-center justify-center overflow-x-auto shadow-inner border border-gray-700">
            {/* The Actual Sticker Container */}
            <div
              id="label-preview-card"
              className="bg-white text-black p-3 rounded shadow-md w-full max-w-[320px] select-none"
              style={{ fontFamily: 'Arial, sans-serif' }}
            >
              {/* Bordered Table matching image */}
              <table className="w-full border-collapse border-2 border-black text-sm">
                <tbody>
                  {/* Row 1: Name (Full width) */}
                  <tr>
                    <td colSpan={2} className="border border-black px-2.5 py-1 text-left font-semibold text-black break-words">
                      <span className="font-normal text-gray-700">Name: </span>
                      <span>{name.trim() || '—'}</span>
                    </td>
                  </tr>

                  {/* Row 2: City (Full width) */}
                  <tr>
                    <td colSpan={2} className="border border-black px-2.5 py-1 text-left font-semibold text-black break-words">
                      <span className="font-normal text-gray-700">City: </span>
                      <span>{city.trim() || '—'}</span>
                    </td>
                  </tr>

                  {/* Row 3: DN No */}
                  <tr>
                    <td className="border border-black px-2.5 py-1 font-semibold text-black text-left w-1/2">
                      DN No
                    </td>
                    <td className="border border-black px-2.5 py-1 font-bold text-black text-right font-mono">
                      {dnNumber.trim() || '—'}
                    </td>
                  </tr>

                  {/* Row 4: Box No */}
                  <tr>
                    <td className="border border-black px-2.5 py-1 font-semibold text-black text-left">
                      Box No
                    </td>
                    <td className="border border-black px-2.5 py-1 font-bold text-black text-right font-mono">
                      {boxNumber.trim() || '—'}
                    </td>
                  </tr>

                  {/* Row 5: Material | Qty (Header) */}
                  <tr className="bg-gray-100">
                    <td className="border border-black px-2.5 py-1 font-bold text-black text-left">
                      Material
                    </td>
                    <td className="border border-black px-2.5 py-1 font-bold text-black text-right">
                      Qty
                    </td>
                  </tr>

                  {/* Dynamic Material Rows */}
                  {materials.filter(m => m.code || m.qty).length === 0 ? (
                    <tr>
                      <td className="border border-black px-2.5 py-1 text-gray-400 italic text-left">
                        (No items)
                      </td>
                      <td className="border border-black px-2.5 py-1 text-gray-400 text-right">
                        —
                      </td>
                    </tr>
                  ) : (
                    materials
                      .filter(m => m.code || m.qty)
                      .map((mat, i) => (
                        <tr key={i}>
                          <td className="border border-black px-2.5 py-1 font-semibold text-black text-left font-mono">
                            {mat.code.trim() || '—'}
                          </td>
                          <td className="border border-black px-2.5 py-1 font-bold text-black text-right font-mono">
                            {mat.qty.toString().trim() || '—'}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>

              {/* Code-128 Barcode below Table */}
              {dnNumber.trim() && (
                <div className="mt-2.5 pt-1 flex flex-col items-center">
                  <BarcodeSvg value={dnNumber.trim()} height={44} fontSize={12} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Print Actions Bar */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-950 border border-gray-700 rounded-xl px-3 py-2">
              <span className="text-xs text-gray-400 font-semibold">Copies:</span>
              <select
                value={copies}
                onChange={(e) => setCopies(Number(e.target.value))}
                className="bg-transparent text-white font-bold text-sm focus:outline-none cursor-pointer"
              >
                {[1, 2, 3, 4, 5, 10].map(n => (
                  <option key={n} value={n} className="bg-gray-900 text-white">
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleReset}
              className="bg-gray-800 hover:bg-gray-700 active:bg-gray-900 text-gray-300 font-semibold py-2 px-3.5 rounded-xl text-xs transition-colors ml-auto"
              title="Clear all fields"
            >
              ↺ Reset
            </button>
          </div>

          <button
            onClick={handlePrint}
            disabled={isPrinting || !dnNumber.trim() || !name.trim() || !city.trim()}
            className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-xl text-base flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-98"
          >
            <span>🖨️</span>
            <span>
              {isPrinting ? 'Printing...' : `Print Label (${copies}x)`}
            </span>
          </button>

          {!printerState.isConnected && (
            <p className="text-[11px] text-gray-400 text-center">
              💡 Tip: <span className="text-blue-400 font-semibold cursor-pointer underline" onClick={() => setShowConnectModal(true)}>Connect Printer</span> for 1-tap printing.
            </p>
          )}
        </div>
      </div>

      {/* Hidden Print Container specifically targeted by @media print */}
      <div id="thermal-print-area" className="hidden">
        <div style={{ width: '72mm', padding: '2mm', boxSizing: 'border-box', background: '#fff', color: '#000', fontFamily: 'Arial, sans-serif' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid black' }}>
            <tbody>
              <tr>
                <td colSpan={2} style={{ border: '1.5px solid black', padding: '4px 6px', fontWeight: '600', fontSize: '13px' }}>
                  <span style={{ fontWeight: 'normal', color: '#555' }}>Name: </span>{name.trim() || '—'}
                </td>
              </tr>
              <tr>
                <td colSpan={2} style={{ border: '1.5px solid black', padding: '4px 6px', fontWeight: '600', fontSize: '13px' }}>
                  <span style={{ fontWeight: 'normal', color: '#555' }}>City: </span>{city.trim() || '—'}
                </td>
              </tr>
              <tr>
                <td style={{ border: '1.5px solid black', padding: '4px 6px', fontWeight: '600', fontSize: '13px' }}>DN No</td>
                <td style={{ border: '1.5px solid black', padding: '4px 6px', fontWeight: 'bold', fontSize: '14px', textAlign: 'right' }}>{dnNumber.trim()}</td>
              </tr>
              <tr>
                <td style={{ border: '1.5px solid black', padding: '4px 6px', fontWeight: '600', fontSize: '13px' }}>Box No</td>
                <td style={{ border: '1.5px solid black', padding: '4px 6px', fontWeight: 'bold', fontSize: '14px', textAlign: 'right' }}>{boxNumber.trim()}</td>
              </tr>
              <tr style={{ background: '#eee' }}>
                <td style={{ border: '1.5px solid black', padding: '4px 6px', fontWeight: 'bold', fontSize: '13px' }}>Material</td>
                <td style={{ border: '1.5px solid black', padding: '4px 6px', fontWeight: 'bold', fontSize: '13px', textAlign: 'right' }}>Qty</td>
              </tr>
              {materials
                .filter(m => m.code || m.qty)
                .map((mat, i) => (
                  <tr key={i}>
                    <td style={{ border: '1.5px solid black', padding: '4px 6px', fontWeight: '600', fontSize: '13px' }}>{mat.code.trim()}</td>
                    <td style={{ border: '1.5px solid black', padding: '4px 6px', fontWeight: 'bold', fontSize: '13px', textAlign: 'right' }}>{mat.qty}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {dnNumber.trim() && (
            <div style={{ marginTop: '8px', textAlign: 'center' }}>
              <BarcodeSvg value={dnNumber.trim()} height={44} fontSize={12} />
            </div>
          )}
        </div>
      </div>

      {/* Camera Scan Modal (Supports Invoice, Name, DN, and Material) */}
      <ScanDNModal
        isOpen={Boolean(scanTarget)}
        mode={scanTarget?.type || 'dn'}
        title={
          scanTarget?.type === 'invoice'
            ? 'Scan Invoice (DN, Name, City)'
            : scanTarget?.type === 'name'
            ? 'Scan Customer Name'
            : scanTarget?.type === 'material'
            ? 'Scan Material Code'
            : 'Scan Delivery Note (DN)'
        }
        onClose={() => setScanTarget(null)}
        onScanned={handleScannedResult}
      />

      {/* Printer Connect Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <span>🔌</span> Connect Printer
              </h3>
              <button
                onClick={() => setShowConnectModal(false)}
                className="text-gray-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-300">
              Select your connection method. Make sure your printer is turned on and paired in Bluetooth settings if using wireless.
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => handleConnect('serial')}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-4 rounded-xl text-sm flex items-center justify-between transition-colors shadow"
              >
                <div className="flex items-center gap-2.5 text-left">
                  <span className="text-xl">📡</span>
                  <div>
                    <div className="font-bold">USB / Serial Port</div>
                    <div className="text-[11px] text-blue-200">Recommended for USB or paired Bluetooth COM</div>
                  </div>
                </div>
                <span>➔</span>
              </button>

              <button
                onClick={() => handleConnect('bluetooth')}
                className="w-full bg-purple-700 hover:bg-purple-600 text-white font-semibold py-3 px-4 rounded-xl text-sm flex items-center justify-between transition-colors shadow"
              >
                <div className="flex items-center gap-2.5 text-left">
                  <span className="text-xl">📶</span>
                  <div>
                    <div className="font-bold">Wireless Bluetooth</div>
                    <div className="text-[11px] text-purple-200">Direct wireless discovery</div>
                  </div>
                </div>
                <span>➔</span>
              </button>

              <button
                onClick={() => {
                  setShowConnectModal(false);
                  printerService.printBrowser();
                }}
                className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors mt-1"
              >
                <span>🖨️</span>
                <span>Use Standard System Print Dialog Instead</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

# Agent Instructions & Architecture Guide (AGENTS.md)

Welcome! This document provides architectural context, domain constraints, critical hardware rules, and testing standards for AI agents working on the **Haeger India Logistics & Warehouse PWA**.

---

## 1. Project Overview & Context

This application is an **offline-capable, warehouse-grade Progressive Web App (PWA)** built for warehouse operators, dispatch teams, and inventory handlers at Haeger India. It runs primarily on Android mobile devices, rugged warehouse handhelds (e.g., Zebra, Honeywell), and desktop Chrome/Edge terminals.

### Core Modules:
1. **Dispatch Module (`/dispatch`)**:
   - Pairs **SAP Delivery Notes (DN)** (10-digit numeric identifiers, e.g., `2134621450`) with **Transporter Consignment Dockets** (C-Note, LR, GR, AWB, E-Way Bill).
   - Automatically tracks package counts, weights, transporter names, and completion status.
   - Detects duplicate DN numbers to prevent double-dispatch errors.
2. **Inventory Module (`/inventory`)**:
   - Pairs **Material Codes** (e.g., `HDA041Z9`) with **Warehouse Bin Locations** (e.g., `A-12-04`).
   - Allows quantity, manufacturing/batch year, and remarks.
   - **Crucial Rule**: **Double / duplicate material scanning is explicitly allowed** across bins. Do not enable strict uniqueness rejection on materials.
3. **Box Label Thermal Printing (`/box-label`)**:
   - Generates and prints standardized 72mm × 36mm thermal box labels.
   - Supports direct TSC TSPL command transmission over **Web Serial API** (USB/Bluetooth COM port) and **Web Bluetooth API** (GATT write), as well as browser thermal print fallbacks.
   - Supports camera scanning of material codes directly from within the box label creation flow.
4. **Data Export & Reporting**:
   - Excel (`.xlsx`) generated using SheetJS with forced text formatting (`@`) to prevent Excel from converting long DN/Docket numbers to scientific notation.
   - UTF-8 BOM (`\uFEFF`) CSV export for full compatibility with mobile Excel/Sheets.
   - WhatsApp-ready summary formatting and Tab-Delimited clipboard copying.

---

## 2. Directory Structure & Key Files

```
haeger/
├── src/
│   ├── components/
│   │   ├── ScannerScreen.jsx          # Live camera viewfinder, OCR/barcode orchestration
│   │   ├── HomeScreen.jsx             # Dispatch module dashboard
│   │   ├── InventoryHomeScreen.jsx    # Inventory module dashboard
│   │   ├── RecordsScreen.jsx          # Dispatch records management & search
│   │   ├── InventoryRecordsScreen.jsx # Inventory records management & search
│   │   ├── PrintLabelScreen.jsx       # Thermal box label printing screen & generator
│   │   ├── ScanDNModal.jsx            # Quick DN scanner modal
│   │   └── ShareModal.jsx             # Export to Excel/CSV, WhatsApp, and Clipboard
│   ├── context/
│   │   └── AppContext.jsx             # Central state machine (reducer, actions, selectors)
│   ├── export/
│   │   └── excelExporter.js           # Excel (.xlsx) & CSV (.csv) workbook generation
│   ├── hooks/
│   │   └── useCamera.js               # Camera stream management, autofocus, torch control
│   ├── ocr/
│   │   ├── numberValidator.js         # Domain regex, checksum, and validation logic
│   │   ├── invoiceExtractor.js        # SAP DN extractor (multi-strategy OCR parsing)
│   │   ├── docketExtractor.js         # Transporter docket extractor (word proximity & regex)
│   │   ├── inventoryExtractor.js      # Material & bin OCR parser
│   │   ├── barcodeScanner.js          # ZXing barcode/QR scanner pipeline
│   │   ├── paddleProcessor.js         # ONNX WebAssembly PaddleOCR neural engine
│   │   └── ocrProcessor.js            # Tesseract.js fallback engine
│   ├── printer/
│   │   ├── printerService.js          # Web Serial & Web Bluetooth driver for TSC Alpha-3RB
│   │   ├── tsplGenerator.js           # TSPL binary/ASCII thermal printer command generator
│   │   └── BarcodeSvg.jsx             # SVG barcode renderer
│   └── session/
│       └── sessionManager.js          # Crash-safe localStorage session persistence
├── tests/                             # Vitest automated test suite (62+ tests)
└── vite.config.js                     # Chunk-split Vite configuration
```

---

## 3. Critical Rules for Future Agents

### Rule 1: NEVER Push Without Asking
- **MANDATORY**: Never run `git push` unless the user explicitly types `push` or instructs you to push.
- Keep all atomic changes committed locally on `main` with clear conventional commit messages.

### Rule 2: Shell & Platform Conventions
- The host OS is **Windows** using **PowerShell**.
- **Do not chain commands using `&&`**; use `;` instead (e.g. `npm test; npm run build`).

### Rule 3: Verification Before Completion
Before completing any task or claiming work is done:
1. Run `npm test` — **all tests must pass (100%)**.
2. Run `npm run build` — **the Vite production build must succeed with zero errors**.
3. If adding or modifying domain logic, write corresponding unit tests in `tests/`.

### Rule 4: TSPL Command Sanitization
- When modifying [`src/printer/tsplGenerator.js`](file:///c:/Users/Lenovo/Desktop/haeger/src/printer/tsplGenerator.js), **always sanitize string fields** (item codes, remarks, box numbers) using `sanitizeTSPLString()`.
- Unescaped double quotes (`"`) or newline/carriage return characters (`\r`, `\n`) break TSC printer command buffers or trigger syntax errors on thermal hardware.

### Rule 5: Camera & Hardware Resource Hygiene
- **Camera Streams**: Always ensure all `MediaStreamTrack` instances are stopped (`track.stop()`) on unmount or mode transition in [`src/hooks/useCamera.js`](file:///c:/Users/Lenovo/Desktop/haeger/src/hooks/useCamera.js).
- **Web Serial / Bluetooth**: Always release stream writer locks in a `finally` block (`writer.releaseLock()`) in [`src/printer/printerService.js`](file:///c:/Users/Lenovo/Desktop/haeger/src/printer/printerService.js). Disconnects must clean up event listeners to avoid memory leaks.

### Rule 6: Rollup / Vite Code-Splitting Rules
- `ppu-paddle-ocr/web` must be dynamically imported via `import('ppu-paddle-ocr/web')`.
- **Never** add `'ppu-paddle-ocr'` statically to `manualChunks` in `vite.config.js`, as it attempts to bundle Node-specific C++ binary addons (`.node` files) that fail browser builds.
- Barcode processing (`@zxing`), standard OCR (`tesseract.js`), and spreadsheet utilities (`xlsx`) must remain in dedicated manual chunks.

---

## 4. Running Tests & Commands

```powershell
# Run the complete unit test suite
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with code coverage (V8)
npx vitest run --coverage

# Run production build
npm run build

# Start local dev server
npm run dev
```

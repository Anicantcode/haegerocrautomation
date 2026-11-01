# Warehouse & Logistics Automation PWA

[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Vitest-2.1-FCC72B?style=flat&logo=vitest&logoColor=black)](https://vitest.dev/)
[![Status](https://img.shields.io/badge/Status-Personal%20Project-success.svg)]()

An offline-first, warehouse-grade Progressive Web App (PWA) engineered for dispatch tracking, inventory bin allocation, and direct thermal box label printing across enterprise and commercial warehouses. Built as an extensible, vendor-agnostic logistics solution designed for manufacturing plants, distribution hubs, and third-party logistics (3PL) providers.

---

## 🌟 Key Features

### 1. Dispatch Module
- **SAP Delivery Note (DN) Extraction**: High-confidence heuristic and regex extraction for 10-digit SAP numbers (e.g. `2134621450`).
- **Docket / Consignment Pairing**: Automatically pairs Delivery Notes with transporter dockets (C-Note, LR, GR, AWB, E-Way Bill).
- **Duplicate Prevention**: Instant duplicate DN detection protects against double-dispatch errors.
- **Dispatch Metrics**: Tracks total packages, aggregate weight, and transporter assignment.

### 2. Inventory Module
- **Material & Bin Pairing**: Scans Material Codes and maps them directly to warehouse Bin locations (e.g. `A-12-04`).
- **Flexible Item Rules**: Supports multiple entries and duplicate scans of the same material code across bins.
- **Batch Tracking**: Records item quantities, production years, and operator remarks.

### 3. Box Label Thermal Printing (TSC Alpha-3RB)
- **Direct Hardware Communication**:
  - **Web Serial API**: Connects directly to TSC Alpha-3RB printers over USB cable or Bluetooth COM ports on Windows & Android.
  - **Web Bluetooth API**: Direct BLE GATT communication for mobile devices.
  - **Browser Thermal Layout**: Fallback print layout formatted specifically for standard 72mm × 36mm thermal roll paper.
- **TSPL Command Generator**: Generates native TSPL printer commands with barcode rendering, box numbering (`Box X of Y`), and sanitization against command injection.
- **In-Modal Material Scanning**: Camera scanner integrated directly into label creation for frictionless code entry.

### 4. Neural OCR & Barcode Pipeline
- **Dual-Engine Architecture**:
  - **Baidu PaddleOCR (ONNX WebAssembly)**: High-accuracy deep-learning text extraction running directly in browser memory.
  - **Tesseract.js**: Lightweight OCR fallback engine.
  - **ZXing Barcode Engine**: Real-time 1D (Code 128, Code 39, EAN) and 2D (QR, DataMatrix) decoding.
- **Decluttered Viewfinder**: Clean, distraction-free camera UI optimized for fast scanning in low-light warehouse aisles.

### 5. Warehouse Data Export & Sharing
- **Excel (.xlsx)**: Generates workbooks with text-encoded columns (`@`) to prevent spreadsheet software from corrupting numeric IDs into scientific notation.
- **CSV with UTF-8 BOM**: Ensures proper character decoding across all versions of Excel on Windows and mobile devices.
- **WhatsApp Summary**: Formats clean text reports for instant dispatch notifications.
- **Clipboard Sync**: One-tap tab-delimited copying for fast pasting into ERP and Google Sheets.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | React 18, React DOM |
| **Build Tool & Bundler** | Vite 5 (Rollup with manual chunk splitting) |
| **Styling** | Tailwind CSS, Autoprefixer |
| **Neural Vision / OCR** | ONNX Runtime Web, `ppu-paddle-ocr/web`, Tesseract.js |
| **Barcode Recognition** | `@zxing/library`, `@zxing/browser`, `jsbarcode` |
| **Hardware Driver** | Web Serial API, Web Bluetooth API (GATT) |
| **Data & Storage** | SheetJS (`xlsx`), `localStorage` (Crash-Safe Session Manager) |
| **Unit Testing & QA** | Vitest 2.1, `@vitest/coverage-v8` |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **Browser**: Google Chrome or Microsoft Edge (required for Web Serial and Web Bluetooth API hardware access)

### Installation

```bash
# Clone the repository
git clone https://github.com/Anicantcode/haegerocrautomation.git

# Navigate to project folder
cd haeger

# Install dependencies
npm install
```

### Running Locally

```bash
# Start development server
npm run dev
```

Visit `http://localhost:5173` in Google Chrome or Microsoft Edge.

---

## 🧪 Testing & Quality Assurance

The codebase includes an automated unit test suite covering domain number validation, OCR extraction heuristics, TSPL generation, Excel export, and session management.

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate code coverage report
npx vitest run --coverage
```

### Production Build

```bash
# Build optimized production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 🖨️ Hardware Setup: TSC Alpha-3RB Printer

1. **Bluetooth Pairing (Windows / Android)**:
   - Turn on the TSC Alpha-3RB printer.
   - Pair the printer in your device's Bluetooth settings (PIN default is usually `0000` or `1234`).
   - In Chrome/Edge, navigate to the **Box Label** screen and click **Connect**.
   - Select either the paired Bluetooth COM port (via Serial) or the BLE GATT service.
2. **Label Dimensions**:
   - Standard Label: **72mm (Width) × 36mm (Height)**.
   - Sensor: Black mark or gap sensor configured.

---

## 📄 Project Status & Commercial Inquiries

This is an independent personal project engineered for modern warehouse operations and supply-chain logistics. It is not affiliated with, sponsored by, or proprietary to any third party. The platform is modular, multi-tenant capable, and available for commercial licensing, customization, and enterprise deployment across manufacturing and logistics companies.

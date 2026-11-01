import { describe, it, expect } from 'vitest';
import {
  createExcelFile,
  createCsvFile,
  formatRecordsForWhatsApp,
  formatRecordsForClipboard,
  createInventoryExcelFile,
  createInventoryCsvFile,
  formatInventoryRecordsForWhatsApp,
  formatInventoryRecordsForClipboard,
} from '../src/export/excelExporter.js';

describe('excelExporter', () => {
  const dispatchRecords = [
    {
      id: 1,
      dnNumber: '2134621450',
      docketNumber: 'DOCK12345',
      boxes: '5',
      weight: '25.5',
      transporter: 'VRL',
      status: 'COMPLETE',
    },
    {
      id: 2,
      dnNumber: '2134621451',
      docketNumber: '',
      boxes: '',
      weight: '',
      transporter: '',
      status: 'PENDING_DOCKET',
    },
  ];

  const inventoryRecords = [
    {
      id: 1,
      material: 'HDA041Z9',
      bin: 'A-12-04',
      quantity: '50',
      year: '2024',
      remark: 'Verified batch',
      status: 'COMPLETE',
    },
  ];

  describe('Dispatch Exporter', () => {
    it('throws when exporting empty records', () => {
      expect(() => createExcelFile([])).toThrow('No records to export');
      expect(() => createCsvFile([])).toThrow('No records to export');
    });

    it('creates excel file structure with text formatting', () => {
      const { wb, filename, blob, file } = createExcelFile(dispatchRecords);
      expect(wb.SheetNames).toContain('Scanned Records');
      expect(filename).toMatch(/^Invoice_Docket_Scan_.*\.xlsx$/);
      expect(blob).toBeDefined();
      expect(file).toBeDefined();

      const ws = wb.Sheets['Scanned Records'];
      // DN cell (B2) should be formatted as string 's'
      expect(ws['B2'].t).toBe('s');
      expect(ws['B2'].v).toBe('2134621450');
    });

    it('creates UTF-8 BOM CSV file', async () => {
      const { filename, blob, file } = createCsvFile(dispatchRecords);
      expect(filename).toMatch(/^Invoice_Docket_Scan_.*\.csv$/);
      expect(file).toBeDefined();

      const bytes = new Uint8Array(await blob.arrayBuffer());
      // UTF-8 BOM is [0xEF, 0xBB, 0xBF]
      expect(bytes[0]).toBe(0xef);
      expect(bytes[1]).toBe(0xbb);
      expect(bytes[2]).toBe(0xbf);

      const text = await blob.text();
      expect(text).toContain('"2134621450"');
      expect(text).toContain('"DOCK12345"');
    });

    it('formats WhatsApp message summary correctly', () => {
      const waText = formatRecordsForWhatsApp(dispatchRecords);
      expect(waText).toContain('Total Records: 2 (1 Complete)');
      expect(waText).toContain('DN: 2134621450');
      expect(waText).toContain('Docket: DOCK12345');
      expect(waText).toContain('Boxes: 5 | Wt: 25.5 | Transporter: VRL');
    });

    it('formats clipboard tab-separated text', () => {
      const clipText = formatRecordsForClipboard(dispatchRecords);
      const lines = clipText.trim().split('\n');
      expect(lines).toHaveLength(3); // Header + 2 rows
      expect(lines[0]).toBe('Sr No\tDN No\tDocket No\tNo of Boxes\tWeight\tTransporter Name');
      expect(lines[1]).toContain('1\t2134621450\tDOCK12345\t5\t25.5\tVRL');
    });
  });

  describe('Inventory Exporter', () => {
    it('throws when exporting empty inventory records', () => {
      expect(() => createInventoryExcelFile([])).toThrow('No inventory records to export');
      expect(() => createInventoryCsvFile([])).toThrow('No inventory records to export');
    });

    it('creates inventory excel file structure with text formatting', () => {
      const { wb, filename, blob } = createInventoryExcelFile(inventoryRecords);
      expect(wb.SheetNames).toContain('Inventory Records');
      expect(filename).toMatch(/^Inventory_Scan_.*\.xlsx$/);
      expect(blob).toBeDefined();

      const ws = wb.Sheets['Inventory Records'];
      expect(ws['B2'].t).toBe('s');
      expect(ws['B2'].v).toBe('HDA041Z9');
      expect(ws['C2'].v).toBe('A-12-04');
    });

    it('creates inventory CSV file with BOM and correct headers', async () => {
      const { filename, blob } = createInventoryCsvFile(inventoryRecords);
      expect(filename).toMatch(/^Inventory_Scan_.*\.csv$/);

      const bytes = new Uint8Array(await blob.arrayBuffer());
      expect(bytes[0]).toBe(0xef);
      expect(bytes[1]).toBe(0xbb);
      expect(bytes[2]).toBe(0xbf);

      const text = await blob.text();
      expect(text).toContain('Sr No,material,bin,quantity,year,remark');
      expect(text).toContain('"HDA041Z9","A-12-04","50","2024","Verified batch"');
    });

    it('formats WhatsApp and clipboard for inventory', () => {
      const waText = formatInventoryRecordsForWhatsApp(inventoryRecords);
      expect(waText).toContain('Material: HDA041Z9  |  Bin: A-12-04');
      expect(waText).toContain('Qty: 50 | Year: 2024 | Remark: Verified batch');

      const clipText = formatInventoryRecordsForClipboard(inventoryRecords);
      expect(clipText).toContain('1\tHDA041Z9\tA-12-04\t50\t2024\tVerified batch');
    });
  });
});

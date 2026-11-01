import { describe, it, expect } from 'vitest';
import { extractInventoryCode } from '../src/ocr/inventoryExtractor.js';

describe('inventoryExtractor', () => {
  it('extracts material code with label', () => {
    const text = `
      Item Details
      Material Code: HDA041Z9
      Qty: 50
    `;
    const res = extractInventoryCode(text, [], 'material');
    expect(res.value).toBe('HDA041Z9');
  });

  it('extracts bin location with label', () => {
    const text = `
      Warehouse Rack
      Bin: A-12-04
      Status: Active
    `;
    const res = extractInventoryCode(text, [], 'bin');
    expect(res.value).toBe('A-12-04');
  });

  it('ignores common stop words like BATCH, LOT, QTY', () => {
    const text = `
      Part No: NCN116N
      BATCH: B12
      QTY: 100
    `;
    const res = extractInventoryCode(text, [], 'material');
    expect(res.value).toBe('NCN116N');
  });
});

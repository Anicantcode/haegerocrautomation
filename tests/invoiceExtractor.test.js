import { describe, it, expect } from 'vitest';
import { extractDNNumber } from '../src/ocr/invoiceExtractor.js';

describe('invoiceExtractor', () => {
  it('extracts inline DN number with colon', () => {
    const text = `
      HAEGER LOGISTICS
      DELIVERY CHALLAN
      DN No: 2134621450
      Date: 25-10-2026
    `;
    const res = extractDNNumber(text);
    expect(res).not.toBeNull();
    expect(res.value).toBe('2134621450');
  });

  it('extracts Delivery Note number without colon', () => {
    const text = `
      Delivery Note No 2134621450
      Item: Steel Fastener
    `;
    const res = extractDNNumber(text);
    expect(res.value).toBe('2134621450');
  });

  it('extracts DN number located on the line below label', () => {
    const text = `
      DELIVERY NOTE NO.
      2134621450
      CUSTOMER: XYZ CORP
    `;
    const res = extractDNNumber(text);
    expect(res.value).toBe('2134621450');
  });

  it('returns empty/low result when text is blank or missing numbers', () => {
    const res = extractDNNumber('Just plain text with no invoice numbers');
    expect(res?.value || '').toBe('');
  });

  it('extracts DN via word bounding box proximity', () => {
    const words = [
      { text: 'DN No', confidence: 90, bbox: { x0: 20, y0: 100, x1: 80, y1: 120 } },
      { text: '2134621450', confidence: 95, bbox: { x0: 90, y0: 100, x1: 200, y1: 120 } },
    ];
    const res = extractDNNumber('', words);
    expect(res.value).toBe('2134621450');
  });

  it('falls back to standalone 10-digit DN number anywhere in text', () => {
    const text = `
      INVOICE DOCUMENT
      BATCH 2134621450
      ITEMS INCLUDED
    `;
    const res = extractDNNumber(text);
    expect(res.value).toBe('2134621450');
  });

  it('does not mistakenly capture TO No when on next line', () => {
    const text = `
      DELIVERY NOTE
      TO No 98765432
      DATE 2026-10-31
    `;
    const res = extractDNNumber(text);
    // TO No is excluded from being captured as DN
    expect(res.value).not.toBe('98765432');
  });
});

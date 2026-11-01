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
});

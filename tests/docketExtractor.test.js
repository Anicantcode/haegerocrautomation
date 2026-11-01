import { describe, it, expect } from 'vitest';
import { extractDocketNumber } from '../src/ocr/docketExtractor.js';

describe('docketExtractor', () => {
  it('extracts explicit Docket number', () => {
    const text = `
      V-TRANS LOGISTICS
      Docket No: 7894561230
      Destination: Pune
    `;
    const res = extractDocketNumber(text);
    expect(res).not.toBeNull();
    expect(res.value).toBe('7894561230');
  });

  it('extracts Consignment Note (C-Note / CN) number', () => {
    const text = `
      TCI EXPRESS
      C-Note No: 356953700227
      Date: 29/10/2026
    `;
    const res = extractDocketNumber(text);
    expect(res.value).toBe('356953700227');
  });

  it('extracts L.R. No (Lorry Receipt)', () => {
    const text = `
      MAHALAXMI TRANSPORT
      L.R. No. 45892147
      Packages: 10
    `;
    const res = extractDocketNumber(text);
    expect(res.value).toBe('45892147');
  });

  it('ignores phone numbers and GST headers', () => {
    const text = `
      Phone: 919876543210
      GSTIN: 27AAAAA0000A1Z5
      Docket: 987654321
    `;
    const res = extractDocketNumber(text);
    expect(res.value).toBe('987654321');
  });
});

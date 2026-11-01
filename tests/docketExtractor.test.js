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

  it('extracts docket number printed on the line below the label', () => {
    const text = `
      TRANSPORT VENDOR
      DOCKET NO:
      9876543210
      Pieces: 4
    `;
    const res = extractDocketNumber(text);
    expect(res.value).toBe('9876543210');
  });

  it('falls back to E-Way bill when docket is absent', () => {
    const text = `
      TAX INVOICE
      E-Way Bill No: 121012345678
      Transporter: SafeExpress
    `;
    const res = extractDocketNumber(text);
    expect(res.value).toBe('121012345678');
  });

  it('extracts docket via word bounding box proximity', () => {
    const words = [
      { text: 'Docket', confidence: 95, bbox: { x0: 10, y0: 50, x1: 60, y1: 70 } },
      { text: '9988776655', confidence: 92, bbox: { x0: 70, y0: 50, x1: 150, y1: 70 } },
    ];
    const res = extractDocketNumber('', words);
    expect(res.value).toBe('9988776655');
  });

  it('handles empty input gracefully', () => {
    const res = extractDocketNumber('', []);
    expect(res.value).toBe('');
    expect(res.confidence).toBe('LOW');
  });
});

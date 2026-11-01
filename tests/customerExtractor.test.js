import { describe, it, expect } from 'vitest';
import { extractCustomerDetails } from '../src/ocr/customerExtractor.js';

describe('customerExtractor', () => {
  it('extracts customer name and city on the same line', () => {
    const text = `
      TAX INVOICE
      Consignee: ACME PRECISION ENTERPRISES PVT LTD
      Destination: BANGALORE
      DN No: 2134621450
    `;
    const res = extractCustomerDetails(text);
    expect(res.name).toBe('ACME PRECISION ENTERPRISES PVT LTD');
    expect(res.city).toBe('BANGALORE');
  });

  it('extracts M/s name pattern and city from address pin line', () => {
    const text = `
      DELIVERY CHALLAN
      Buyer: M/s SUPREME INDUSTRIES
      Plot 12, Bhosari MIDC, Pune - 411026
      DN No: 2134621450
    `;
    const res = extractCustomerDetails(text);
    expect(res.name).toBe('SUPREME INDUSTRIES');
    expect(res.city).toBe('PUNE');
  });

  it('extracts customer name from next line under Billed To label', () => {
    const text = `
      COMMERCIAL INVOICE
      Billed To:
      BHARAT FORGE LIMITED
      MUMBAI 400001
      DN No: 2134621450
    `;
    const res = extractCustomerDetails(text);
    expect(res.name).toBe('BHARAT FORGE LIMITED');
    expect(res.city).toBe('MUMBAI');
  });

  it('handles empty or unrecognized input safely', () => {
    const res = extractCustomerDetails('');
    expect(res.name).toBe('');
    expect(res.city).toBe('');
  });
});

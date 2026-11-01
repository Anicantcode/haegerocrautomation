import { describe, it, expect } from 'vitest';
import {
  applyOCRCorrections,
  cleanNumeric,
  isExplicitPhoneNumber,
  isPotentialMobileNumber,
  isPinCode,
  validateDNNumber,
  validateDocketNumber,
  isLikelyArtefact,
} from '../src/ocr/numberValidator.js';

describe('numberValidator', () => {
  describe('applyOCRCorrections', () => {
    it('corrects character confusions for numeric strings', () => {
      // O -> 0, I -> 1, l -> 1, S -> 5, B -> 8, G -> 6, Z -> 2
      expect(applyOCRCorrections('O123')).toBe('0123');
      expect(applyOCRCorrections('l234')).toBe('1234');
      expect(applyOCRCorrections('S678')).toBe('5678');
      expect(applyOCRCorrections('B90')).toBe('890');
    });
  });

  describe('cleanNumeric', () => {
    it('strips dashes, dots, and whitespace', () => {
      expect(cleanNumeric('2134-621.450 ')).toBe('2134621450');
    });
  });

  describe('phone and pin detection', () => {
    it('detects 12-digit Indian mobile with 91 prefix', () => {
      expect(isExplicitPhoneNumber('919876543210')).toBe(true);
      expect(isExplicitPhoneNumber('91-98765-43210')).toBe(true);
    });

    it('detects 11-digit mobile with leading 0', () => {
      expect(isExplicitPhoneNumber('09876543210')).toBe(true);
    });

    it('detects toll-free numbers', () => {
      expect(isExplicitPhoneNumber('1800123456')).toBe(true);
    });

    it('detects 6-digit PIN codes', () => {
      expect(isPinCode('411014')).toBe(true);
      expect(isPinCode('110001')).toBe(true);
      expect(isPinCode('123')).toBe(false);
    });
  });

  describe('validateDNNumber', () => {
    it('validates 8 to 12 digit delivery note numbers with HIGH confidence', () => {
      const res = validateDNNumber('2134621450');
      expect(res.value).toBe('2134621450');
      expect(res.confidence).toBe('HIGH');
    });

    it('applies OCR correction on letter confusions (e.g. O instead of 0)', () => {
      const res = validateDNNumber('213462145O');
      expect(res.value).toBe('2134621450');
      expect(res.confidence).toBe('HIGH');
    });

    it('flags explicit phone numbers as LOW confidence', () => {
      const res = validateDNNumber('919876543210');
      expect(res.isPhone).toBe(true);
      expect(res.confidence).toBe('LOW');
    });

    it('returns LOW confidence for numbers with fewer than 6 digits', () => {
      const res = validateDNNumber('1234');
      expect(res.confidence).toBe('LOW');
    });
  });

  describe('validateDocketNumber', () => {
    it('validates 7 to 15 digit docket consignment numbers', () => {
      const res = validateDocketNumber('356953700227462');
      expect(res.value).toBe('356953700227462');
      expect(res.confidence).toBe('HIGH');
    });

    it('rejects pin codes as docket numbers', () => {
      const res = validateDocketNumber('411014');
      expect(res.confidence).toBe('LOW');
    });
  });

  describe('isLikelyArtefact', () => {
    it('detects repetitive or sequence artefacts', () => {
      expect(isLikelyArtefact('00000000')).toBe(true);
      expect(isLikelyArtefact('11111111')).toBe(true);
      expect(isLikelyArtefact('2134621450')).toBe(false);
    });
  });
});

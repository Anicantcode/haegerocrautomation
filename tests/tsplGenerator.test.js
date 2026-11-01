import { describe, it, expect } from 'vitest';
import { generateBoxLabelTSPL } from '../src/printer/tsplGenerator.js';

describe('tsplGenerator', () => {
  it('generates valid TSPL commands with table structure and barcode', () => {
    const tspl = generateBoxLabelTSPL({
      dnNumber: '2134621450',
      boxNumber: '3',
      materials: [
        { code: 'HDA041Z9', qty: '1' },
        { code: 'NCN116N', qty: '36' },
      ],
      copies: 1,
    });

    expect(tspl).toContain('SIZE 72 mm,');
    expect(tspl).toContain('GAP 2 mm, 0 mm');
    expect(tspl).toContain('CLS');
    expect(tspl).toContain('BOX 20, 20, 556,');
    expect(tspl).toContain('"DN No"');
    expect(tspl).toContain('"2134621450"');
    expect(tspl).toContain('"Box No"');
    expect(tspl).toContain('"3"');
    expect(tspl).toContain('"HDA041Z9"');
    expect(tspl).toContain('"1"');
    expect(tspl).toContain('"NCN116N"');
    expect(tspl).toContain('"36"');
    expect(tspl).toContain('BARCODE');
    expect(tspl).toContain('"2134621450"');
    expect(tspl).toContain('PRINT 1, 1');
  });

  it('handles multiple copies', () => {
    const tspl = generateBoxLabelTSPL({
      dnNumber: '12345678',
      boxNumber: '1',
      materials: [{ code: 'MAT1', qty: '5' }],
      copies: 3,
    });
    expect(tspl).toContain('PRINT 3, 1');
  });

  it('sanitizes double quotes and control characters to prevent TSPL syntax errors', () => {
    const tspl = generateBoxLabelTSPL({
      dnNumber: '2134"621450',
      boxNumber: 'Box "3"\n',
      materials: [{ code: 'MAT "A"\r\n', qty: '10"' }],
      copies: 1,
    });

    // Content inside quotes must not have unescaped quotes or raw newlines
    expect(tspl).not.toContain('2134"621450"');
    expect(tspl).toContain('"2134 621450"');
    expect(tspl).toContain('"Box 3"');
    expect(tspl).toContain('"MAT A"');
    expect(tspl).toContain('"10"');
  });
});

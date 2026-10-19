import { describe, it, expect } from 'vitest';
import { formatRWF, formatMoney, parseToCents } from '../lib/money';

describe('money helpers', () => {
  it('formats cents as RWF with 2 decimals', () => {
    expect(formatRWF(150000)).toBe('1,500.00');
    expect(formatRWF(0)).toBe('0.00');
    expect(formatRWF(250)).toBe('2.50');
  });

  it('supports 0-decimal formatting', () => {
    expect(formatRWF(150000, { decimals: 0 })).toBe('1,500');
  });

  it('prefixes with RWF via formatMoney', () => {
    expect(formatMoney(150000)).toBe('RWF 1,500.00');
  });

  it('parses user input to integer cents', () => {
    expect(parseToCents('1500')).toBe(150000);
    expect(parseToCents('1500.5')).toBe(150050);
    expect(parseToCents(0)).toBe(0);
    expect(parseToCents('0.01')).toBe(1);
  });

  it('rejects invalid input', () => {
    expect(Number.isNaN(parseToCents(''))).toBe(true);
    expect(Number.isNaN(parseToCents('abc'))).toBe(true);
    expect(Number.isNaN(parseToCents('-5'))).toBe(true);
    expect(Number.isNaN(parseToCents(null))).toBe(true);
  });
});

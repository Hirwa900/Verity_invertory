import { describe, it, expect } from 'vitest';
import getBusinessDate, { isDateOnly, monthStart } from '../lib/businessDate';

describe('businessDate', () => {
  it('formats a fixed instant using the Kigali timezone', () => {
    // 2026-10-18 23:30 UTC is already 2026-10-19 in Kigali (UTC+2).
    expect(getBusinessDate(new Date('2026-10-18T23:30:00Z'))).toBe('2026-10-19');
    expect(getBusinessDate(new Date('2026-10-18T09:00:00Z'))).toBe('2026-10-18');
  });

  it('validates YYYY-MM-DD strings', () => {
    expect(isDateOnly('2026-10-18')).toBe(true);
    expect(isDateOnly('2026-10-8')).toBe(false);
    expect(isDateOnly('not-a-date')).toBe(false);
    expect(isDateOnly('')).toBe(false);
  });

  it('computes the first day of the current Kigali month', () => {
    expect(monthStart(new Date('2026-10-18T09:00:00Z'))).toBe('2026-10-01');
  });
});

import { describe, it, expect } from 'vitest';
import { canDeleteSales } from '../pages/SalesHistoryPage';

describe('canDeleteSales (delete button visibility)', () => {
  it('shows delete controls to admins only', () => {
    expect(canDeleteSales({ role: 'admin' })).toBe(true);
    expect(canDeleteSales({ role: 'seller' })).toBe(false);
    expect(canDeleteSales({ role: 'seller', uid: 'seller1' })).toBe(false);
  });

  it('denies when there is no user or no role', () => {
    expect(canDeleteSales(null)).toBe(false);
    expect(canDeleteSales(undefined)).toBe(false);
    expect(canDeleteSales({})).toBe(false);
    expect(canDeleteSales({ role: 'superuser' })).toBe(false);
  });
});

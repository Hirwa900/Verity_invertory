import { describe, it, expect } from 'vitest';
import { computeReport } from '../pages/ReportsPage';

const sale = (overrides = {}) => ({
  isActive: true,
  totalCents: 10000,
  items: [{ productId: 'p1', productName: 'Widget', quantity: 2, unitPriceCents: 5000, buyingPriceCents: 3000, subtotalCents: 10000, profitCents: 4000 }],
  ...overrides,
});

describe('computeReport', () => {
  it('computes revenue, cost of goods, profit, and top products', () => {
    const sales = [
      sale(),
      sale({ totalCents: 5000, items: [{ productId: 'p2', productName: 'Gadget', quantity: 1, unitPriceCents: 5000, buyingPriceCents: 2000, subtotalCents: 5000, profitCents: 3000 }] }),
    ];
    const expenses = [{ amountCents: 1500 }];
    const report = computeReport(sales, expenses, '2026-10-18', '2026-10-18');

    expect(report.totalSalesCents).toBe(15000);
    expect(report.costOfGoodsCents).toBe(2 * 3000 + 1 * 2000);
    expect(report.grossProfitCents).toBe(15000 - 8000);
    expect(report.expensesCents).toBe(1500);
    expect(report.netProfitCents).toBe(7000 - 1500);
    expect(report.transactions).toBe(2);
    expect(report.itemsSold).toBe(3);
    expect(report.topProducts.length).toBe(2);
    expect(report.topProducts[0].name).toBe('Widget');
  });

  it('excludes archived sales', () => {
    const report = computeReport([sale({ isActive: false })], [], '2026-10-18', '2026-10-18');
    expect(report.totalSalesCents).toBe(0);
    expect(report.transactions).toBe(0);
  });

  it('handles empty data', () => {
    const report = computeReport([], [], '2026-10-18', '2026-10-18');
    expect(report.totalSalesCents).toBe(0);
    expect(report.netProfitCents).toBe(0);
    expect(report.topProducts).toEqual([]);
  });

  it('reports negative net profit when expenses exceed gross profit', () => {
    const report = computeReport([sale()], [{ amountCents: 99999 }], '2026-10-18', '2026-10-18');
    expect(report.netProfitCents).toBeLessThan(0);
  });
});

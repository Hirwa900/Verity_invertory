import { describe, it, expect } from 'vitest';
import { computeReport, periodRange } from '../pages/ReportsPage';
import getBusinessDate, { monthStart } from '../lib/businessDate';

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

  it('excludes deleted (reversed) sales from every period total', () => {
    const other = sale({ totalCents: 5000, items: [{ productId: 'p2', productName: 'Gadget', quantity: 1, unitPriceCents: 5000, buyingPriceCents: 2000, subtotalCents: 5000, profitCents: 3000 }] });

    const before = computeReport([sale(), other], [], '2026-10-18', '2026-10-18');
    expect(before.totalSalesCents).toBe(15000);
    expect(before.transactions).toBe(2);

    const reversed = sale({
      isActive: false,
      status: 'reversed',
      deletedBy: 'admin1',
      deletedByName: 'Admin',
      deletedAt: '2026-10-18T12:00:00.000Z',
    });
    const after = computeReport([reversed, other], [], '2026-10-18', '2026-10-18');
    expect(after.totalSalesCents).toBe(5000);
    expect(after.costOfGoodsCents).toBe(2000);
    expect(after.transactions).toBe(1);
    expect(after.itemsSold).toBe(1);
    expect(after.grossProfitCents).toBe(3000);
    expect(after.topProducts).toHaveLength(1);
    expect(after.topProducts[0].name).toBe('Gadget');
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

  it('handles an expenses-only period (no sales at all)', () => {
    const report = computeReport([], [{ amountCents: 2500 }], '2026-10-18', '2026-10-18');
    expect(report.transactions).toBe(0);
    expect(report.totalSalesCents).toBe(0);
    expect(report.expensesCents).toBe(2500);
    expect(report.netProfitCents).toBe(-2500);
    expect(report.topProducts).toEqual([]);
  });

  it('keeps item-less sales as transactions without product rows', () => {
    const report = computeReport([sale({ items: [] })], [], '2026-10-18', '2026-10-18');
    expect(report.transactions).toBe(1);
    expect(report.itemsSold).toBe(0);
    expect(report.topProducts).toEqual([]);
  });
});

describe('periodRange', () => {
  it('daily covers exactly today', () => {
    const { startDate, endDate } = periodRange('daily');
    const today = getBusinessDate();
    expect(startDate).toBe(today);
    expect(endDate).toBe(today);
  });

  it('weekly starts on Monday and ends today, spanning at most 7 days', () => {
    const { startDate, endDate } = periodRange('weekly');
    expect(endDate).toBe(getBusinessDate());
    expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(`${startDate}T00:00:00Z`).getUTCDay()).toBe(1);
    const days = (new Date(`${endDate}T00:00:00Z`) - new Date(`${startDate}T00:00:00Z`)) / 86400000;
    expect(days).toBeGreaterThanOrEqual(0);
    expect(days).toBeLessThanOrEqual(6);
  });

  it('monthly starts on the 1st of the current month', () => {
    const { startDate, endDate } = periodRange('monthly');
    expect(startDate).toBe(monthStart());
    expect(endDate).toBe(getBusinessDate());
    expect(startDate <= endDate).toBe(true);
  });

  it('yearly starts on January 1st of the current year', () => {
    const { startDate, endDate } = periodRange('yearly');
    expect(endDate).toBe(getBusinessDate());
    expect(startDate).toBe(`${endDate.slice(0, 4)}-01-01`);
    expect(startDate <= endDate).toBe(true);
  });

  it('falls back to a single business day for custom or unknown periods', () => {
    for (const period of ['custom', 'unknown', undefined]) {
      const { startDate, endDate } = periodRange(period);
      expect(startDate).toBe(getBusinessDate());
      expect(endDate).toBe(startDate);
    }
  });
});

describe('report query equivalence (ranged active server query vs fetch-all)', () => {
  const rangedSale = (businessDate, totalCents, overrides = {}) => ({
    isActive: true,
    businessDate,
    totalCents,
    items: [{
      productId: 'p1',
      productName: 'Widget',
      quantity: 1,
      unitPriceCents: totalCents,
      buyingPriceCents: 0,
      subtotalCents: totalCents,
      profitCents: totalCents,
    }],
    ...overrides,
  });

  const startDate = '2026-10-05';
  const endDate = '2026-10-15';
  const dataset = [
    rangedSale('2026-10-01', 100),
    rangedSale('2026-10-05', 200),
    rangedSale('2026-10-10', 300),
    rangedSale('2026-10-15', 400),
    rangedSale('2026-10-20', 500),
    rangedSale('2026-10-08', 600, { isActive: false }),
  ];
  const inRange = (s) => s.businessDate >= startDate && s.businessDate <= endDate;

  it('old flow (fetch all, filter by date client-side) and new flow (server isActive + date range) produce identical totals', () => {
    const oldFlow = computeReport(dataset.filter(inRange), [], startDate, endDate);

    const serverRows = dataset.filter((s) => s.isActive === true).filter(inRange);
    const newFlow = computeReport(serverRows.filter(inRange), [], startDate, endDate);

    expect(newFlow.totalSalesCents).toBe(oldFlow.totalSalesCents);
    expect(newFlow.costOfGoodsCents).toBe(oldFlow.costOfGoodsCents);
    expect(newFlow.grossProfitCents).toBe(oldFlow.grossProfitCents);
    expect(newFlow.transactions).toBe(oldFlow.transactions);
    expect(newFlow.itemsSold).toBe(oldFlow.itemsSold);
    expect(oldFlow.totalSalesCents).toBe(200 + 300 + 400);
    expect(oldFlow.transactions).toBe(3);
  });

  it('includes boundary dates on both ends and excludes out-of-range and archived sales', () => {
    const report = computeReport(
      dataset.filter((s) => s.isActive === true).filter(inRange),
      [],
      startDate,
      endDate,
    );
    expect(report.totalSalesCents).toBe(200 + 300 + 400);
    expect(report.transactions).toBe(3);
    expect(report.startDate).toBe(startDate);
    expect(report.endDate).toBe(endDate);
  });
});

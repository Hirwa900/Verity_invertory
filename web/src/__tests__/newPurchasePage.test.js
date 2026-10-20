import { describe, it, expect } from 'vitest';
import { preparePurchaseItems, buildPurchasePayload } from '../pages/NewPurchasePage';

const row = (overrides = {}) => ({ productId: 'p1', quantity: 1, unitCost: '1000', ...overrides });

describe('preparePurchaseItems', () => {
  it('converts rows to cent-based payload items', () => {
    const items = preparePurchaseItems([row(), row({ productId: 'p2', quantity: 3, unitCost: '2.5' })]);
    expect(items).toEqual([
      { productId: 'p1', quantity: 1, unitCostCents: 100000 },
      { productId: 'p2', quantity: 3, unitCostCents: 250 },
    ]);
  });

  it('ignores untouched empty rows left over from "Add another product"', () => {
    const items = preparePurchaseItems([
      row(),
      { productId: '', quantity: 1, unitCost: '' },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].productId).toBe('p1');
  });

  it('rejects a submission with no product selected at all', () => {
    expect(() => preparePurchaseItems([{ productId: '', quantity: 1, unitCost: '' }]))
      .toThrow(/select at least one product/i);
  });

  it('rejects the same product on two lines', () => {
    expect(() => preparePurchaseItems([row(), row({ unitCost: '900' })]))
      .toThrow(/more than one line/i);
  });

  it('rejects a missing or invalid unit cost', () => {
    expect(() => preparePurchaseItems([row({ unitCost: '' })])).toThrow(/unit cost/i);
    expect(() => preparePurchaseItems([row({ unitCost: 'abc' })])).toThrow(/unit cost/i);
    expect(() => preparePurchaseItems([row({ unitCost: '-5' })])).toThrow(/unit cost/i);
  });

  it('rejects non-positive or fractional quantities', () => {
    expect(() => preparePurchaseItems([row({ quantity: 0 })])).toThrow(/positive whole numbers/i);
    expect(() => preparePurchaseItems([row({ quantity: 2.5 })])).toThrow(/positive whole numbers/i);
    expect(() => preparePurchaseItems([row({ quantity: '' })])).toThrow(/positive whole numbers/i);
  });
});

describe('buildPurchasePayload', () => {
  it('always sends the idempotency key the backend requires', () => {
    const payload = buildPurchasePayload([row()], '2026-10-20', 'req-12345678');
    expect(payload).toEqual({
      items: [{ productId: 'p1', quantity: 1, unitCostCents: 100000 }],
      businessDate: '2026-10-20',
      clientRequestId: 'req-12345678',
    });
  });

  it('fails loudly when the request id is missing', () => {
    expect(() => buildPurchasePayload([row()], '2026-10-20', '')).toThrow(/client request id/i);
    expect(() => buildPurchasePayload([row()], '2026-10-20', undefined)).toThrow(/client request id/i);
  });
});

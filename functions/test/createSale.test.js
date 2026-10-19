const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const createSale = require('../src/calls/createSale');
const { createFakeDb, fixedNow, seedSeller, seedInactive, seedProduct, read, readProduct, allDocs, ctx } = require('./helpers/seed');

const deps = () => {
  const db = createFakeDb();
  return { db, auth: {}, now: fixedNow };
};

describe('createSale', () => {
  it('creates a sale, decrements stock, logs movement + audit + idempotency', async () => {
    const d = deps();
    seedSeller(d.db);
    seedProduct(d.db, 'p1', { quantity: 10, sellingPriceCents: 500, buyingPriceCents: 300 });

    const result = await createSale(d)({ items: [{ productId: 'p1', quantity: 2 }], clientRequestId: 'req-0001' }, ctx('seller1'));

    assert.equal(result.totalCents, 1000);
    assert.ok(result.saleId);
    assert.equal(readProduct(d.db, 'p1').quantity, 8);
    const sale = read(d.db, `verity_sales/${result.saleId}`);
    assert.equal(sale.totalCents, 1000);
    assert.equal(sale.items[0].profitCents, 400);
    assert.equal(sale.isActive, true);
    assert.ok(read(d.db, 'verity_idempotency/req-0001'));
    const movements = allDocs(d.db).filter((v) => v.type === 'SALE');
    assert.equal(movements.length, 1);
    const audits = allDocs(d.db).filter((v) => v.action === 'sale.create');
    assert.equal(audits.length, 1);
  });

  it('rejects a duplicate clientRequestId', async () => {
    const d = deps();
    seedSeller(d.db);
    seedProduct(d.db, 'p1', { quantity: 10 });
    const payload = { items: [{ productId: 'p1', quantity: 1 }], clientRequestId: 'req-dup-1' };
    await createSale(d)(payload, ctx('seller1'));
    await assert.rejects(
      () => createSale(d)(payload, ctx('seller1')),
      (e) => e.code === 'invalid-argument' && /already submitted/.test(e.message),
    );
  });

  it('rejects insufficient stock without mutating anything', async () => {
    const d = deps();
    seedSeller(d.db);
    seedProduct(d.db, 'p1', { quantity: 1 });
    await assert.rejects(
      () => createSale(d)({ items: [{ productId: 'p1', quantity: 5 }], clientRequestId: 'req-short' }, ctx('seller1')),
      (e) => e.code === 'invalid-argument' && /Insufficient stock/.test(e.message),
    );
    assert.equal(readProduct(d.db, 'p1').quantity, 1);
  });

  it('rejects unauthenticated, inactive, and invalid payloads', async () => {
    const d = deps();
    seedSeller(d.db);
    seedInactive(d.db);
    seedProduct(d.db, 'p1');

    const payload = { items: [{ productId: 'p1', quantity: 1 }], clientRequestId: 'req-authz1' };
    await assert.rejects(() => createSale(d)(payload, null), (e) => e.code === 'unauthenticated');
    await assert.rejects(() => createSale(d)(payload, ctx('ghost1')), (e) => e.code === 'permission-denied');
    await assert.rejects(
      () => createSale(d)({ ...payload, clientRequestId: 'short' }, ctx('seller1')),
      (e) => e.code === 'invalid-argument',
    );
    await assert.rejects(
      () => createSale(d)({ items: [], clientRequestId: 'req-empty1' }, ctx('seller1')),
      (e) => e.code === 'invalid-argument',
    );
    await assert.rejects(
      () => createSale(d)({ items: [{ productId: 'p1', quantity: 2 }, { productId: 'p1', quantity: 1 }], clientRequestId: 'req-dupe22' }, ctx('seller1')),
      (e) => e.code === 'invalid-argument' && /only once/.test(e.message),
    );
    await assert.rejects(
      () => createSale(d)({ items: [{ productId: 'p1', quantity: 1 }], clientRequestId: 'req-good01', businessDate: 'not-a-date' }, ctx('seller1')),
      (e) => e.code === 'invalid-argument' && /date/i.test(e.message),
    );
  });

  it('rejects callers whose token role is missing or does not match their profile', async () => {
    const d = deps();
    seedSeller(d.db);
    seedProduct(d.db, 'p1', { quantity: 10 });
    const payload = { items: [{ productId: 'p1', quantity: 1 }], clientRequestId: 'req-mismatch1' };
    await assert.rejects(
      () => createSale(d)(payload, { auth: { uid: 'seller1', token: { role: 'admin' } } }),
      (e) => e.code === 'permission-denied',
    );
    await assert.rejects(
      () => createSale(d)(payload, { auth: { uid: 'seller1' } }),
      (e) => e.code === 'permission-denied',
    );
    assert.equal(readProduct(d.db, 'p1').quantity, 10);
  });
});

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const createPurchase = require('../src/calls/createPurchase');
const adjustStock = require('../src/calls/adjustStock');
const { createFakeDb, fixedNow, seedAdmin, seedSeller, seedProduct, read, readProduct, allDocs, ctx } = require('./helpers/seed');

const deps = () => {
  const db = createFakeDb();
  return { db, auth: {}, now: fixedNow };
};

describe('createPurchase', () => {
  it('increments stock and updates buying price', async () => {
    const d = deps();
    seedAdmin(d.db);
    seedProduct(d.db, 'p1', { quantity: 4, buyingPriceCents: 300 });

    const result = await createPurchase(d)({
      items: [{ productId: 'p1', quantity: 6, unitCostCents: 250 }],
      businessDate: '2026-10-18',
      clientRequestId: 'pur-00000001',
    }, ctx('admin1'));

    assert.equal(result.totalCents, 1500);
    const product = readProduct(d.db, 'p1');
    assert.equal(product.quantity, 10);
    assert.equal(product.buyingPriceCents, 250);
    const purchase = read(d.db, `verity_purchases/${result.purchaseId}`);
    assert.equal(purchase.totalCents, 1500);
    assert.equal(purchase.businessDate, '2026-10-18');
    assert.equal(purchase.clientRequestId, 'pur-00000001');
    assert.ok(read(d.db, 'verity_idempotency/pur-00000001'));
    assert.equal(allDocs(d.db).filter((v) => v.type === 'PURCHASE').length, 1);
  });

  it('rejects missing unit cost and non-positive quantities', async () => {
    const d = deps();
    seedAdmin(d.db);
    seedProduct(d.db, 'p1');
    await assert.rejects(
      () => createPurchase(d)({ items: [{ productId: 'p1', quantity: 1 }], clientRequestId: 'pur-missing1' }, ctx('admin1')),
      (e) => e.code === 'invalid-argument',
    );
    await assert.rejects(
      () => createPurchase(d)({ items: [{ productId: 'p1', quantity: 0, unitCostCents: 100 }], clientRequestId: 'pur-missing2' }, ctx('admin1')),
      (e) => e.code === 'invalid-argument',
    );
  });

  it('rejects a missing or malformed clientRequestId', async () => {
    const d = deps();
    seedAdmin(d.db);
    seedProduct(d.db, 'p1');
    const items = [{ productId: 'p1', quantity: 1, unitCostCents: 100 }];
    await assert.rejects(
      () => createPurchase(d)({ items }, ctx('admin1')),
      (e) => e.code === 'invalid-argument' && /client request id/i.test(e.message),
    );
    await assert.rejects(
      () => createPurchase(d)({ items, clientRequestId: 'short' }, ctx('admin1')),
      (e) => e.code === 'invalid-argument' && /client request id/i.test(e.message),
    );
    assert.equal(readProduct(d.db, 'p1').quantity, 10);
  });

  it('rejects a sequential duplicate clientRequestId without double-applying stock', async () => {
    const d = deps();
    seedAdmin(d.db);
    seedProduct(d.db, 'p1', { quantity: 4 });
    const payload = {
      items: [{ productId: 'p1', quantity: 6, unitCostCents: 250 }],
      clientRequestId: 'pur-dup-0001',
    };
    await createPurchase(d)(payload, ctx('admin1'));
    await assert.rejects(
      () => createPurchase(d)(payload, ctx('admin1')),
      (e) => e.code === 'invalid-argument' && /already submitted/.test(e.message),
    );
    assert.equal(readProduct(d.db, 'p1').quantity, 10);
    assert.equal(allDocs(d.db).filter((v) => v.type === 'PURCHASE').length, 1);
    assert.equal(allDocs(d.db).filter((v) => v.type === 'PURCHASE' && v.userId === 'admin1').length, 1);
  });

  it('concurrent submissions with the same clientRequestId apply stock exactly once', async () => {
    const d = deps();
    seedAdmin(d.db);
    seedProduct(d.db, 'p1', { quantity: 4 });
    const payload = {
      items: [{ productId: 'p1', quantity: 6, unitCostCents: 250 }],
      clientRequestId: 'pur-conc-0001',
    };
    const results = await Promise.allSettled([
      createPurchase(d)(payload, ctx('admin1')),
      createPurchase(d)(payload, ctx('admin1')),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0].reason.code, 'invalid-argument');
    assert.match(rejected[0].reason.message, /already submitted/);
    assert.equal(readProduct(d.db, 'p1').quantity, 10);
    assert.equal(allDocs(d.db).filter((v) => v.type === 'PURCHASE').length, 1);
    assert.equal(allDocs(d.db).filter((v) => v.type === 'PURCHASE' && v.userId === 'admin1').length, 1);
  });

  it('sellers cannot purchase', async () => {
    const d = deps();
    seedSeller(d.db);
    seedProduct(d.db, 'p1');
    await assert.rejects(
      () => createPurchase(d)({ items: [{ productId: 'p1', quantity: 1, unitCostCents: 100 }], clientRequestId: 'pur-seller01' }, ctx('seller1')),
      (e) => e.code === 'permission-denied',
    );
  });
});

describe('adjustStock', () => {
  it('applies a positive adjustment and logs movement', async () => {
    const d = deps();
    seedAdmin(d.db);
    seedProduct(d.db, 'p1', { quantity: 5 });

    const result = await adjustStock(d)({ productId: 'p1', quantityChange: 3, reason: 'Found stock' }, ctx('admin1'));
    assert.equal(result.newQuantity, 8);
    assert.equal(readProduct(d.db, 'p1').quantity, 8);
    const movement = allDocs(d.db).find((v) => v.type === 'ADJUSTMENT');
    assert.equal(movement.quantity, 3);
    assert.equal(movement.note, 'Found stock');
  });

  it('rejects an adjustment that would go negative', async () => {
    const d = deps();
    seedAdmin(d.db);
    seedProduct(d.db, 'p1', { quantity: 2 });
    await assert.rejects(
      () => adjustStock(d)({ productId: 'p1', quantityChange: -5 }, ctx('admin1')),
      (e) => e.code === 'invalid-argument' && /negative/.test(e.message),
    );
    assert.equal(readProduct(d.db, 'p1').quantity, 2);
  });

  it('rejects zero, fractional, missing-product, and invalid payloads', async () => {
    const d = deps();
    seedAdmin(d.db);
    seedProduct(d.db, 'p1', { quantity: 2 });
    await assert.rejects(
      () => adjustStock(d)({ productId: 'p1', quantityChange: 0 }, ctx('admin1')),
      (e) => e.code === 'invalid-argument',
    );
    await assert.rejects(
      () => adjustStock(d)({ productId: 'p1', quantityChange: 1.5 }, ctx('admin1')),
      (e) => e.code === 'invalid-argument',
    );
    await assert.rejects(
      () => adjustStock(d)({ productId: 'nope', quantityChange: 1 }, ctx('admin1')),
      (e) => e.code === 'not-found',
    );
    await assert.rejects(
      () => adjustStock(d)({ quantityChange: 1 }, ctx('admin1')),
      (e) => e.code === 'invalid-argument',
    );
  });

  it('sellers cannot adjust stock', async () => {
    const d = deps();
    seedSeller(d.db);
    seedProduct(d.db, 'p1', { quantity: 2 });
    await assert.rejects(
      () => adjustStock(d)({ productId: 'p1', quantityChange: 1 }, ctx('seller1')),
      (e) => e.code === 'permission-denied',
    );
  });
});

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const createSale = require('../src/calls/createSale');
const archiveSale = require('../src/calls/archiveSale');
const restoreSale = require('../src/calls/restoreSale');
const { createFakeDb, fixedNow, seedAdmin, seedSeller, seedProduct, read, readProduct, allDocs, ctx } = require('./helpers/seed');

const deps = () => {
  const db = createFakeDb();
  return { db, auth: {}, now: fixedNow };
};

const makeSale = async (d) => {
  seedSeller(d.db);
  seedProduct(d.db, 'p1', { quantity: 10, sellingPriceCents: 500, buyingPriceCents: 300 });
  return createSale(d)({ items: [{ productId: 'p1', quantity: 2 }], clientRequestId: 'req-sale-1' }, ctx('seller1'));
};

describe('archiveSale / restoreSale', () => {
  it('admin archives a sale, returns stock, logs RETURN movement', async () => {
    const d = deps();
    seedAdmin(d.db);
    const { saleId } = await makeSale(d);
    assert.equal(readProduct(d.db, 'p1').quantity, 8);

    const result = await archiveSale(d)({ saleId }, ctx('admin1'));
    assert.equal(result.itemsReturned, 1);
    assert.equal(readProduct(d.db, 'p1').quantity, 10);
    assert.equal(read(d.db, `verity_sales/${saleId}`).isActive, false);
    assert.equal(allDocs(d.db).filter((v) => v.type === 'RETURN').length, 1);
  });

  it('rejects archiving twice and unknown sales', async () => {
    const d = deps();
    seedAdmin(d.db);
    const { saleId } = await makeSale(d);
    await archiveSale(d)({ saleId }, ctx('admin1'));
    await assert.rejects(
      () => archiveSale(d)({ saleId }, ctx('admin1')),
      (e) => e.code === 'already-exists',
    );
    await assert.rejects(
      () => archiveSale(d)({ saleId: 'missing99' }, ctx('admin1')),
      (e) => e.code === 'not-found',
    );
  });

  it('sellers cannot archive', async () => {
    const d = deps();
    seedAdmin(d.db);
    const { saleId } = await makeSale(d);
    await assert.rejects(
      () => archiveSale(d)({ saleId }, ctx('seller1')),
      (e) => e.code === 'permission-denied',
    );
  });

  it('restore re-deducts stock and re-activates the sale', async () => {
    const d = deps();
    seedAdmin(d.db);
    const { saleId } = await makeSale(d);
    await archiveSale(d)({ saleId }, ctx('admin1'));
    assert.equal(readProduct(d.db, 'p1').quantity, 10);

    await restoreSale(d)({ saleId }, ctx('admin1'));
    assert.equal(readProduct(d.db, 'p1').quantity, 8);
    assert.equal(read(d.db, `verity_sales/${saleId}`).isActive, true);
  });

  it('restore rejects when stock is insufficient', async () => {
    const d = deps();
    seedAdmin(d.db);
    const { saleId } = await makeSale(d);
    await archiveSale(d)({ saleId }, ctx('admin1'));
    d.db.seed('verity_products/p1', { ...readProduct(d.db, 'p1'), quantity: 1 });
    await assert.rejects(
      () => restoreSale(d)({ saleId }, ctx('admin1')),
      (e) => e.code === 'invalid-argument' && /Insufficient stock/.test(e.message),
    );
    assert.equal(read(d.db, `verity_sales/${saleId}`).isActive, false);
  });

  it('restore rejects a sale that is not archived', async () => {
    const d = deps();
    seedAdmin(d.db);
    const { saleId } = await makeSale(d);
    await assert.rejects(
      () => restoreSale(d)({ saleId }, ctx('admin1')),
      (e) => e.code === 'invalid-argument',
    );
  });
});

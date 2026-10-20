const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const createSale = require('../src/calls/createSale');
const deleteSale = require('../src/calls/deleteSale');
const restoreSale = require('../src/calls/restoreSale');
const {
  createFakeDb, fixedNow, seedAdmin, seedSeller, seedInactive, seedProduct, read, readProduct, allDocs, ctx,
} = require('./helpers/seed');

const deps = () => {
  const db = createFakeDb();
  return { db, auth: {}, now: fixedNow };
};

const makeSale = async (d) => {
  seedSeller(d.db);
  seedProduct(d.db, 'p1', { quantity: 10, sellingPriceCents: 500, buyingPriceCents: 300 });
  return createSale(d)({ items: [{ productId: 'p1', quantity: 2 }], clientRequestId: 'req-del-1' }, ctx('seller1'));
};

describe('deleteSale', () => {
  it('admin deletes a sale: reverses it, restores stock, logs RETURN movement and audit trail', async () => {
    const d = deps();
    seedAdmin(d.db);
    const { saleId } = await makeSale(d);
    assert.equal(readProduct(d.db, 'p1').quantity, 8);

    const result = await deleteSale(d)({ saleId }, ctx('admin1'));
    assert.equal(result.itemsReturned, 1);
    assert.equal(result.status, 'reversed');

    assert.equal(readProduct(d.db, 'p1').quantity, 10);
    const sale = read(d.db, `verity_sales/${saleId}`);
    assert.equal(sale.isActive, false);
    assert.equal(sale.status, 'reversed');
    assert.equal(sale.deletedBy, 'admin1');
    assert.equal(sale.deletedByName, 'Admin');
    assert.equal(sale.deletedAt, fixedNow());
    assert.equal(sale.totalCents, 1000);
    assert.equal(sale.items.length, 1);

    const returns = allDocs(d.db).filter((v) => v.type === 'RETURN');
    assert.equal(returns.length, 1);
    assert.equal(returns[0].referenceId, saleId);
    assert.equal(returns[0].note, `Sale #${saleId} deleted (reversed)`);

    const audits = allDocs(d.db).filter((v) => v.action === 'sale.delete');
    assert.equal(audits.length, 1);
    assert.equal(audits[0].actorId, 'admin1');
    assert.equal(audits[0].details.saleId, saleId);
    assert.equal(audits[0].details.totalCents, 1000);
    assert.equal(audits[0].createdAt, fixedNow());
  });

  it('marks the sale so reports, dashboards, and counts exclude it', async () => {
    const d = deps();
    seedAdmin(d.db);
    const { saleId } = await makeSale(d);

    await deleteSale(d)({ saleId }, ctx('admin1'));

    const sale = read(d.db, `verity_sales/${saleId}`);
    // Reports and dashboard query/filter on isActive, so revenue and
    // transaction counts drop without any second source of truth.
    assert.equal(sale.isActive, false);
    assert.equal(sale.status, 'reversed');
    const active = allDocs(d.db).filter((v) => v.isActive === true && v.totalCents);
    assert.equal(active.length, 0);
  });

  it('repeated deletion attempts are rejected and never restore stock twice', async () => {
    const d = deps();
    seedAdmin(d.db);
    const { saleId } = await makeSale(d);

    await deleteSale(d)({ saleId }, ctx('admin1'));
    assert.equal(readProduct(d.db, 'p1').quantity, 10);

    await assert.rejects(
      () => deleteSale(d)({ saleId }, ctx('admin1')),
      (e) => e.code === 'already-exists' && /already been deleted/.test(e.message),
    );
    await assert.rejects(
      () => deleteSale(d)({ saleId }, ctx('admin1')),
      (e) => e.code === 'already-exists',
    );

    assert.equal(readProduct(d.db, 'p1').quantity, 10);
    assert.equal(allDocs(d.db).filter((v) => v.type === 'RETURN').length, 1);
    assert.equal(allDocs(d.db).filter((v) => v.action === 'sale.delete').length, 1);
  });

  it('sellers cannot delete sales', async () => {
    const d = deps();
    seedAdmin(d.db);
    const { saleId } = await makeSale(d);

    await assert.rejects(
      () => deleteSale(d)({ saleId }, ctx('seller1')),
      (e) => e.code === 'permission-denied',
    );
    assert.equal(read(d.db, `verity_sales/${saleId}`).isActive, true);
    assert.equal(readProduct(d.db, 'p1').quantity, 8);
    assert.equal(allDocs(d.db).filter((v) => v.action === 'sale.delete').length, 0);
  });

  it('rejects unknown sales, unauthenticated, inactive, and claim-mismatched callers', async () => {
    const d = deps();
    seedAdmin(d.db);
    seedInactive(d.db);
    const { saleId } = await makeSale(d);

    await assert.rejects(
      () => deleteSale(d)({ saleId: 'missing99' }, ctx('admin1')),
      (e) => e.code === 'not-found',
    );
    await assert.rejects(
      () => deleteSale(d)({ saleId }, null),
      (e) => e.code === 'unauthenticated',
    );
    await assert.rejects(
      () => deleteSale(d)({ saleId }, ctx('ghost1')),
      (e) => e.code === 'permission-denied',
    );
    await assert.rejects(
      () => deleteSale(d)({ saleId }, { auth: { uid: 'admin1', token: { role: 'seller' } } }),
      (e) => e.code === 'permission-denied',
    );
    await assert.rejects(
      () => deleteSale(d)({ saleId }, { auth: { uid: 'admin1' } }),
      (e) => e.code === 'permission-denied',
    );
    await assert.rejects(
      () => deleteSale(d)({ saleId: '' }, ctx('admin1')),
      (e) => e.code === 'invalid-argument',
    );

    assert.equal(read(d.db, `verity_sales/${saleId}`).isActive, true);
    assert.equal(readProduct(d.db, 'p1').quantity, 8);
  });

  it('restoring a deleted sale re-deducts stock and clears the reversal markers', async () => {
    const d = deps();
    seedAdmin(d.db);
    const { saleId } = await makeSale(d);
    await deleteSale(d)({ saleId }, ctx('admin1'));
    assert.equal(readProduct(d.db, 'p1').quantity, 10);

    await restoreSale(d)({ saleId }, ctx('admin1'));
    assert.equal(readProduct(d.db, 'p1').quantity, 8);
    const sale = read(d.db, `verity_sales/${saleId}`);
    assert.equal(sale.isActive, true);
    assert.equal(sale.status, null);
    assert.equal(sale.deletedAt, null);
    assert.equal(sale.deletedBy, null);
    assert.equal(sale.deletedByName, null);
    assert.equal(sale.archivedAt, null);
  });

  it('a sale archived first cannot be double-reversed by deleteSale', async () => {
    const d = deps();
    seedAdmin(d.db);
    const { saleId } = await makeSale(d);
    const archiveSale = require('../src/calls/archiveSale');
    await archiveSale(d)({ saleId }, ctx('admin1'));
    assert.equal(readProduct(d.db, 'p1').quantity, 10);

    await assert.rejects(
      () => deleteSale(d)({ saleId }, ctx('admin1')),
      (e) => e.code === 'already-exists',
    );
    assert.equal(readProduct(d.db, 'p1').quantity, 10);
    assert.equal(allDocs(d.db).filter((v) => v.type === 'RETURN').length, 1);
  });
});

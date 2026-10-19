const { createFakeDb } = require('./fakeFirestore');

const FIXED_NOW = '2026-10-18T12:00:00.000Z';
const fixedNow = () => FIXED_NOW;

const seedAdmin = (db, uid = 'admin1', name = 'Admin') => {
  db.seed(`verity_users/${uid}`, { name, role: 'admin', isActive: true });
  return { uid, name, role: 'admin' };
};
const seedSeller = (db, uid = 'seller1') => {
  db.seed(`verity_users/${uid}`, { name: 'Seller', role: 'seller', isActive: true });
  return { uid, name: 'Seller', role: 'seller' };
};
const seedInactive = (db, uid = 'ghost1') => {
  db.seed(`verity_users/${uid}`, { name: 'Ghost', role: 'seller', isActive: false });
  return { uid, name: 'Ghost', role: 'seller' };
};

const seedProduct = (db, id, overrides = {}) => {
  const product = {
    name: `Product ${id}`,
    sellingPriceCents: 500,
    buyingPriceCents: 300,
    quantity: 10,
    isActive: true,
    categoryId: 'cat1',
    ...overrides,
  };
  db.seed(`verity_products/${id}`, product);
  return product;
};

const read = (db, path) => db.dump()[path];
const readProduct = (db, id) => read(db, `verity_products/${id}`);
const allDocs = (db) => Object.values(db.dump()).filter((v) => v && typeof v === 'object');

const ROLE_BY_UID = { admin1: 'admin', admin2: 'admin', seller1: 'seller', ghost1: 'seller' };
const ctx = (uid) => ({ auth: { uid, token: { role: ROLE_BY_UID[uid] } } });

module.exports = { createFakeDb, fixedNow, seedAdmin, seedSeller, seedInactive, seedProduct, read, readProduct, allDocs, ctx, ROLE_BY_UID, FIXED_NOW };

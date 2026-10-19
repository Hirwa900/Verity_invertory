import { describe, it, beforeAll, afterAll, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
} from 'firebase/firestore';

const here = dirname(fileURLToPath(import.meta.url));
const RULES = readFileSync(join(here, '..', '..', 'firestore.rules'), 'utf8');

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-verity',
    firestore: { rules: RULES, host: '127.0.0.1', port: 8080 },
  });
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'verity_users/admin1'), { name: 'Admin', email: 'admin@x.com', role: 'admin', isActive: true });
    await setDoc(doc(db, 'verity_users/seller1'), { name: 'Seller One', email: 's1@x.com', role: 'seller', isActive: true });
    await setDoc(doc(db, 'verity_users/seller2'), { name: 'Seller Two', email: 's2@x.com', role: 'seller', isActive: true });
    await setDoc(doc(db, 'verity_users/inactive1'), { name: 'Ghost', email: 'g@x.com', role: 'seller', isActive: false });
    await setDoc(doc(db, 'verity_categories/cat1'), { name: 'Drinks', createdAt: null });
    await setDoc(doc(db, 'verity_products/p1'), {
      name: 'Juice', categoryId: 'cat1', buyingPriceCents: 300, sellingPriceCents: 500,
      quantity: 10, minimumQuantity: 2, isActive: true, unit: 'bottle', sku: null, createdAt: null, updatedAt: null,
    });
    await setDoc(doc(db, 'verity_sales/sale1'), {
      userId: 'seller1', userName: 'Seller One', businessDate: '2026-10-18', totalCents: 1000,
      isActive: true, items: [], clientRequestId: 'seed-sale-1', createdAt: null, archivedAt: null,
    });
    await setDoc(doc(db, 'verity_sales/sale2'), {
      userId: 'seller2', userName: 'Seller Two', businessDate: '2026-10-18', totalCents: 500,
      isActive: true, items: [], clientRequestId: 'seed-sale-2', createdAt: null, archivedAt: null,
    });
    await setDoc(doc(db, 'verity_purchases/pur1'), {
      userId: 'admin1', userName: 'Admin', businessDate: '2026-10-18', totalCents: 3000, items: [], createdAt: null,
    });
    await setDoc(doc(db, 'verity_stockMovements/mv1'), {
      productId: 'p1', productName: 'Juice', userId: 'admin1', userName: 'Admin',
      type: 'ADJUSTMENT', quantity: 10, referenceId: null, note: '', createdAt: null,
    });
    await setDoc(doc(db, 'verity_expenses/exp1'), {
      title: 'Transport', category: 'Transport', amountCents: 2000, description: null,
      businessDate: '2026-10-18', userId: 'admin1', userName: 'Admin', createdAt: null,
    });
  });
});

afterEach(() => testEnv.clearFirestore());
afterAll(() => testEnv.cleanup());

const anon = () => testEnv.unauthenticatedContext().firestore();
const admin = () => testEnv.authenticatedContext('admin1', { role: 'admin' }).firestore();
const seller1 = () => testEnv.authenticatedContext('seller1', { role: 'seller' }).firestore();
const seller2 = () => testEnv.authenticatedContext('seller2', { role: 'seller' }).firestore();
const inactiveSeller = () => testEnv.authenticatedContext('inactive1', { role: 'seller' }).firestore();
const spoofedAdmin = () => testEnv.authenticatedContext('seller1', { role: 'admin' }).firestore();
const claimlessUser = () => testEnv.authenticatedContext('seller1', {}).firestore();

describe('anonymous access', () => {
  it('cannot read any collection', async () => {
    await assertFails(getDoc(doc(anon(), 'verity_products/p1')));
    await assertFails(getDoc(doc(anon(), 'verity_sales/sale1')));
    await assertFails(getDocs(query(collection(anon(), 'verity_products'))));
    await assertFails(getDocs(query(collection(anon(), 'verity_users'))));
  });
  it('cannot write anything', async () => {
    await assertFails(setDoc(doc(anon(), 'verity_products/evil'), { name: 'x', quantity: 999, isActive: true }));
    await assertFails(setDoc(doc(anon(), 'verity_users/evil'), { role: 'admin', isActive: true }));
    await assertFails(addDoc(collection(anon(), 'verity_expenses'), { amountCents: 1 }));
  });
});

describe('admin access', () => {
  it('can read business collections', async () => {
    await assertSucceeds(getDoc(doc(admin(), 'verity_products/p1')));
    await assertSucceeds(getDoc(doc(admin(), 'verity_sales/sale1')));
    await assertSucceeds(getDoc(doc(admin(), 'verity_purchases/pur1')));
    await assertSucceeds(getDoc(doc(admin(), 'verity_stockMovements/mv1')));
    await assertSucceeds(getDoc(doc(admin(), 'verity_expenses/exp1')));
    await assertSucceeds(getDocs(query(collection(admin(), 'verity_users'), orderBy('name'))));
    await assertSucceeds(getDocs(query(collection(admin(), 'verity_sales'), where('isActive', '==', true), orderBy('businessDate', 'desc'))));
  });

  it('can create a category and a zero-quantity product', async () => {
    await assertSucceeds(addDoc(collection(admin(), 'verity_categories'), { name: 'Snacks', createdAt: null }));
    await assertSucceeds(setDoc(doc(admin(), 'verity_products/newp'), {
      name: 'New', categoryId: null, buyingPriceCents: 100, sellingPriceCents: 200,
      quantity: 0, minimumQuantity: 0, isActive: true, unit: 'piece', sku: null, createdAt: null, updatedAt: null,
    }));
  });

  it('can update catalog fields including prices, but never quantity', async () => {
    await assertSucceeds(updateDoc(doc(admin(), 'verity_products/p1'), { sellingPriceCents: 700, buyingPriceCents: 400 }));
    await assertFails(updateDoc(doc(admin(), 'verity_products/p1'), { quantity: 999 }));
    await assertFails(updateDoc(doc(admin(), 'verity_products/p1'), { sellingPriceCents: 700, quantity: 999 }));
  });

  it('cannot create a product with starting stock or inactive', async () => {
    await assertFails(setDoc(doc(admin(), 'verity_products/bad1'), { name: 'x', quantity: 5, isActive: true }));
    await assertFails(setDoc(doc(admin(), 'verity_products/bad2'), { name: 'x', quantity: 0, isActive: false }));
  });

  it('can CRUD expenses but cannot write sales, movements, idempotency, meta, or user profiles', async () => {
    await assertSucceeds(setDoc(doc(admin(), 'verity_expenses/e2'), {
      title: 'Fuel', category: 'Transport', amountCents: 5000, businessDate: '2026-10-18',
      userId: 'admin1', userName: 'Admin', createdAt: null,
    }));
    await assertFails(addDoc(collection(admin(), 'verity_sales'), { userId: 'admin1', totalCents: 1 }));
    await assertFails(addDoc(collection(admin(), 'verity_stockMovements'), { productId: 'p1', type: 'ADJUSTMENT', quantity: 5 }));
    await assertFails(setDoc(doc(admin(), 'verity_idempotency/x'), { saleId: 's' }));
    await assertFails(getDoc(doc(admin(), 'verity_idempotency/x')));
    await assertFails(setDoc(doc(admin(), 'verity_meta/adminGuard'), { updatedAt: null }));
    await assertFails(getDoc(doc(admin(), 'verity_meta/adminGuard')));
    await assertFails(setDoc(doc(admin(), 'verity_users/seller1'), { name: 'Hacked', email: 's1@x.com', role: 'admin', isActive: true }));
  });

  it('can deactivate a product', async () => {
    await assertSucceeds(updateDoc(doc(admin(), 'verity_products/p1'), { isActive: false }));
  });
});

describe('seller access', () => {
  it('can read products and categories', async () => {
    await assertSucceeds(getDocs(query(collection(seller1(), 'verity_products'), where('isActive', '==', true), orderBy('name'))));
    await assertSucceeds(getDocs(query(collection(seller1(), 'verity_categories'), orderBy('name'))));
  });

  it('can read only their own sales', async () => {
    await assertSucceeds(getDocs(query(collection(seller1(), 'verity_sales'),
      where('userId', '==', 'seller1'), where('isActive', '==', true), orderBy('businessDate', 'desc'))));
    await assertFails(getDoc(doc(seller1(), 'verity_sales/sale2')));
    await assertFails(getDocs(query(collection(seller1(), 'verity_sales'))));
    await assertFails(getDocs(query(collection(seller1(), 'verity_sales'), where('userId', '==', 'seller2'))));
  });

  it('cannot read purchases, movements, expenses, or other users', async () => {
    await assertFails(getDoc(doc(seller1(), 'verity_purchases/pur1')));
    await assertFails(getDoc(doc(seller1(), 'verity_stockMovements/mv1')));
    await assertFails(getDoc(doc(seller1(), 'verity_expenses/exp1')));
    await assertFails(getDocs(query(collection(seller1(), 'verity_users'))));
    await assertFails(getDoc(doc(seller1(), 'verity_users/seller2')));
    await assertSucceeds(getDoc(doc(seller1(), 'verity_users/seller1')));
  });

  it('cannot write products, prices, stock, sales, or any protected collection', async () => {
    await assertFails(setDoc(doc(seller1(), 'verity_products/evil'), { name: 'x', quantity: 999, isActive: true }));
    await assertFails(updateDoc(doc(seller1(), 'verity_products/p1'), { sellingPriceCents: 1 }));
    await assertFails(updateDoc(doc(seller1(), 'verity_products/p1'), { quantity: 999 }));
    await assertFails(addDoc(collection(seller1(), 'verity_sales'), { userId: 'seller1', totalCents: 1 }));
    await assertFails(addDoc(collection(seller1(), 'verity_stockMovements'), { productId: 'p1', type: 'THEFT', quantity: 99 }));
    await assertFails(addDoc(collection(seller1(), 'verity_expenses'), { amountCents: 1 }));
    await assertFails(addDoc(collection(seller1(), 'verity_categories'), { name: 'x' }));
    await assertFails(setDoc(doc(seller1(), 'verity_users/seller1'), { name: 'x', email: 's1@x.com', role: 'admin', isActive: true }));
    await assertFails(setDoc(doc(seller1(), 'verity_users/evil'), { role: 'admin', isActive: true }));
    await assertFails(deleteDoc(doc(seller1(), 'verity_products/p1')));
  });
});

describe('role and claim consistency', () => {
  it('rejects a seller whose token claims admin (claim/profile mismatch)', async () => {
    await assertFails(getDoc(doc(spoofedAdmin(), 'verity_products/p1')));
    await assertFails(getDocs(query(collection(spoofedAdmin(), 'verity_sales'))));
    await assertFails(addDoc(collection(spoofedAdmin(), 'verity_categories'), { name: 'x' }));
  });

  it('rejects a user with no role claim', async () => {
    await assertFails(getDoc(doc(claimlessUser(), 'verity_products/p1')));
  });

  it('rejects an inactive account even with a valid seller claim', async () => {
    await assertFails(getDoc(doc(inactiveSeller(), 'verity_products/p1')));
    await assertFails(getDocs(query(collection(inactiveSeller(), 'verity_sales'), where('userId', '==', 'inactive1'))));
  });

  it('no client can change any user role through Firestore directly', async () => {
    await assertFails(updateDoc(doc(admin(), 'verity_users/seller1'), { role: 'admin' }));
    await assertFails(updateDoc(doc(admin(), 'verity_users/admin1'), { isActive: false }));
    await assertFails(setDoc(doc(admin(), 'verity_users/newadmin'), { role: 'admin', isActive: true }));
  });
});

import {
  collection, getDocs, query, where, orderBy, limit as fbLimit, documentId, startAfter,
} from 'firebase/firestore';
import { db } from './firebase';
import { cachedRead } from './queryCache';

const snapList = (snapshot) => snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

// Products and categories are read on many pages (Dashboard, Products, Stock,
// New Sale, New Purchase). They are cached until a business write invalidates
// the cache or the entry expires; pass { fresh: true } to force a re-read.
export async function listProducts({ activeOnly = false, fresh = false } = {}) {
  const key = `products:${activeOnly ? 'active' : 'all'}`;
  const load = () => {
    const constraints = [];
    if (activeOnly) constraints.push(where('isActive', '==', true));
    constraints.push(orderBy('name'));
    return getDocs(query(collection(db, 'verity_products'), ...constraints)).then(snapList);
  };
  if (fresh) return load();
  return cachedRead(key, load);
}

export function listCategories({ fresh = false } = {}) {
  const load = () => getDocs(query(collection(db, 'verity_categories'), orderBy('name'))).then(snapList);
  if (fresh) return load();
  return cachedRead('categories:all', load);
}

export function salesQueryPlan({ userId = null, activeOnly = true, startDate = null, endDate = null } = {}) {
  const filters = [];
  if (activeOnly) filters.push({ field: 'isActive', op: '==', value: true });
  if (userId) filters.push({ field: 'userId', op: '==', value: userId });
  if (startDate) filters.push({ field: 'businessDate', op: '>=', value: startDate });
  if (endDate) filters.push({ field: 'businessDate', op: '<=', value: endDate });
  return { filters, sort: { field: 'businessDate', direction: 'desc' } };
}

// Returns one page of sales plus the snapshot needed to fetch the next page.
// `cursor` is the last document snapshot from the previous page.
export async function listSalesPage(options = {}, { pageSize = 50, cursor = null } = {}) {
  const { filters, sort } = salesQueryPlan(options);
  const constraints = [
    ...filters.map((f) => where(f.field, f.op, f.value)),
    orderBy(sort.field, sort.direction),
    fbLimit(pageSize),
  ];
  if (cursor) constraints.push(startAfter(cursor));
  const snapshot = await getDocs(query(collection(db, 'verity_sales'), ...constraints));
  const docs = snapshot.docs;
  return { sales: snapList(snapshot), cursor: docs.length ? docs[docs.length - 1] : null, hasMore: docs.length === pageSize };
}

export async function listSales(options = {}) {
  const { filters, sort } = salesQueryPlan(options);
  const constraints = [
    ...filters.map((f) => where(f.field, f.op, f.value)),
    orderBy(sort.field, sort.direction),
  ];
  const snapshot = await getDocs(query(collection(db, 'verity_sales'), ...constraints));
  return snapList(snapshot);
}

export async function listPurchases({ pageSize = 50, cursor = null } = {}) {
  const constraints = [orderBy('businessDate', 'desc'), fbLimit(pageSize)];
  if (cursor) constraints.push(startAfter(cursor));
  const snapshot = await getDocs(query(collection(db, 'verity_purchases'), ...constraints));
  const docs = snapshot.docs;
  return {
    purchases: snapList(snapshot),
    cursor: docs.length ? docs[docs.length - 1] : null,
    hasMore: docs.length === pageSize,
  };
}

export async function listStockMovements({ productId = null, max = 50 } = {}) {
  const constraints = [];
  if (productId) constraints.push(where('productId', '==', productId));
  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(fbLimit(max));
  const snapshot = await getDocs(query(collection(db, 'verity_stockMovements'), ...constraints));
  return snapList(snapshot);
}

export async function listExpenses({ startDate = null, endDate = null } = {}) {
  const constraints = [];
  if (startDate && endDate) {
    constraints.push(where('businessDate', '>=', startDate));
    constraints.push(where('businessDate', '<=', endDate));
  } else if (startDate) {
    constraints.push(where('businessDate', '>=', startDate));
  } else if (endDate) {
    constraints.push(where('businessDate', '<=', endDate));
  }
  constraints.push(orderBy('businessDate', 'desc'));
  const snapshot = await getDocs(query(collection(db, 'verity_expenses'), ...constraints));
  return snapList(snapshot);
}

export async function listUsers() {
  const snapshot = await getDocs(query(collection(db, 'verity_users'), orderBy('name')));
  return snapList(snapshot);
}

export async function fetchDocsByIds(collectionName, ids) {
  if (!ids.length) return [];
  const chunks = [];
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
  const results = [];
  for (const chunk of chunks) {
    const snapshot = await getDocs(query(collection(db, collectionName), where(documentId(), 'in', chunk)));
    results.push(...snapList(snapshot));
  }
  return results;
}

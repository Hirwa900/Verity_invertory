import {
  collection, getDocs, query, where, orderBy, limit as fbLimit, documentId,
} from 'firebase/firestore';
import { db } from './firebase';

const snapList = (snapshot) => snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

export async function listProducts({ activeOnly = false } = {}) {
  const constraints = [];
  if (activeOnly) constraints.push(where('isActive', '==', true));
  constraints.push(orderBy('name'));
  const snapshot = await getDocs(query(collection(db, 'verity_products'), ...constraints));
  return snapList(snapshot);
}

export async function listCategories() {
  const snapshot = await getDocs(query(collection(db, 'verity_categories'), orderBy('name')));
  return snapList(snapshot);
}

export function salesQueryPlan({ userId = null, activeOnly = true, startDate = null, endDate = null } = {}) {
  const filters = [];
  if (activeOnly) filters.push({ field: 'isActive', op: '==', value: true });
  if (userId) filters.push({ field: 'userId', op: '==', value: userId });
  if (startDate) filters.push({ field: 'businessDate', op: '>=', value: startDate });
  if (endDate) filters.push({ field: 'businessDate', op: '<=', value: endDate });
  return { filters, sort: { field: 'businessDate', direction: 'desc' } };
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

export async function listPurchases() {
  const snapshot = await getDocs(query(collection(db, 'verity_purchases'), orderBy('businessDate', 'desc')));
  return snapList(snapshot);
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

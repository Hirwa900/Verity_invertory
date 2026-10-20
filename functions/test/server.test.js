const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { createApp, OPERATIONS } = require('../src/server');
const createSale = require('../src/calls/createSale');
const deleteSale = require('../src/calls/deleteSale');
const adjustStock = require('../src/calls/adjustStock');
const {
  createFakeDb, fixedNow, seedSeller, seedAdmin, seedProduct, readProduct, read,
} = require('./helpers/seed');

const VALID_TOKENS = {
  'token-seller': { uid: 'seller1', role: 'seller' },
  'token-admin': { uid: 'admin1', role: 'admin' },
};

const verifyIdToken = async (token) => {
  const decoded = VALID_TOKENS[token];
  if (!decoded) throw new Error('invalid token');
  return decoded;
};

describe('express server', () => {
  const db = createFakeDb();
  const deps = { db, auth: {}, now: fixedNow };
  const handlers = {
    createSale: createSale(deps),
    deleteSale: deleteSale(deps),
    adjustStock: adjustStock(deps),
  };
  const resolve = () => ({ ready: true, error: null, handlers });

  let server;
  let base;

  const post = (path, { token, body, headers = {} } = {}) =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: typeof body === 'string' ? body : JSON.stringify(body ?? {}),
    });

  before(async () => {
    seedSeller(db);
    seedAdmin(db);
    const app = createApp({ resolve, verifyIdToken });
    await new Promise((resolveListen) => { server = app.listen(0, resolveListen); });
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => new Promise((done) => server.close(done)));

  it('serves a health check reporting configured state', async () => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.configured, true);
  });

  it('rejects calls without a bearer token', async () => {
    const res = await post('/api/createSale', { body: { data: {} } });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error.code, 'unauthenticated');
  });

  it('rejects an invalid ID token', async () => {
    const res = await post('/api/createSale', { token: 'garbage', body: { data: {} } });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error.code, 'unauthenticated');
  });

  it('runs createSale with verified uid/claims and preserves business rules', async () => {
    seedProduct(db, 'p-srv-1', { quantity: 10 });
    const payload = {
      data: { items: [{ productId: 'p-srv-1', quantity: 2 }], clientRequestId: 'req-srv-1' },
    };
    const res = await post('/api/createSale', { token: 'token-seller', body: payload });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.data.saleId);
    assert.equal(body.data.totalCents, 1000);
    assert.equal(readProduct(db, 'p-srv-1').quantity, 8);
  });

  it('preserves idempotency over HTTP', async () => {
    seedProduct(db, 'p-srv-2', { quantity: 10 });
    const payload = {
      data: { items: [{ productId: 'p-srv-2', quantity: 1 }], clientRequestId: 'req-srv-dup' },
    };
    const first = await post('/api/createSale', { token: 'token-seller', body: payload });
    assert.equal(first.status, 200);
    const second = await post('/api/createSale', { token: 'token-seller', body: payload });
    assert.equal(second.status, 400);
    const body = await second.json();
    assert.equal(body.error.code, 'invalid-argument');
    assert.match(body.error.message, /already submitted/i);
    assert.equal(readProduct(db, 'p-srv-2').quantity, 9);
  });

  it('preserves role checks (seller cannot call admin-only operations)', async () => {
    seedProduct(db, 'p-srv-3', { quantity: 5 });
    const res = await post('/api/adjustStock', {
      token: 'token-seller',
      body: { data: { productId: 'p-srv-3', quantity: -1, reason: 'damage' } },
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.code, 'permission-denied');
    assert.equal(readProduct(db, 'p-srv-3').quantity, 5);
  });

  it('rejects unknown operations', async () => {
    const res = await post('/api/notARealOp', { token: 'token-admin', body: {} });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error.code, 'not-found');
  });

  it('maps a handler not-found error to 404 (deleteSale on a missing sale)', async () => {
    const res = await post('/api/deleteSale', {
      token: 'token-admin',
      body: { data: { saleId: 'no-such-sale' } },
    });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error.code, 'not-found');
    assert.match(body.error.message, /not found/i);
  });

  it('maps requireProductRef not-found errors to 404 (adjustStock on a missing product)', async () => {
    const res = await post('/api/adjustStock', {
      token: 'token-admin',
      body: { data: { productId: 'missing-product', quantityChange: 1, reason: 'count' } },
    });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error.code, 'not-found');
    assert.match(body.error.message, /product not found/i);
  });

  it('rejects malformed JSON bodies', async () => {
    const res = await post('/api/createSale', { token: 'token-admin', body: '{not-json' });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, 'invalid-argument');
  });

  it('allows CORS for known origins and withholds it from unknown origins', async () => {
    const allowed = await post('/api/createSale', {
      token: 'token-admin',
      body: {},
      headers: { Origin: 'http://localhost:5173' },
    });
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');

    const blocked = await post('/api/createSale', {
      token: 'token-admin',
      body: {},
      headers: { Origin: 'https://evil.example' },
    });
    assert.equal(blocked.headers.get('access-control-allow-origin'), null);
  });

  it('exposes only the documented operations', () => {
    assert.deepEqual(OPERATIONS, [
      'createSale', 'archiveSale', 'restoreSale', 'deleteSale', 'createPurchase',
      'adjustStock', 'createAppUser', 'updateAppUser',
    ]);
  });

  it('serves deleteSale to admins only and blocks repeated reversals over HTTP', async () => {
    seedProduct(db, 'p-srv-del', { quantity: 10 });
    const created = await post('/api/createSale', {
      token: 'token-seller',
      body: { data: { items: [{ productId: 'p-srv-del', quantity: 2 }], clientRequestId: 'req-srv-del1' } },
    });
    assert.equal(created.status, 200);
    const { saleId } = (await created.json()).data;
    assert.equal(readProduct(db, 'p-srv-del').quantity, 8);

    const denied = await post('/api/deleteSale', { token: 'token-seller', body: { data: { saleId } } });
    assert.equal(denied.status, 403);
    assert.equal((await denied.json()).error.code, 'permission-denied');
    assert.equal(readProduct(db, 'p-srv-del').quantity, 8);
    assert.equal(read(db, `verity_sales/${saleId}`).isActive, true);

    const allowed = await post('/api/deleteSale', { token: 'token-admin', body: { data: { saleId } } });
    assert.equal(allowed.status, 200);
    const body = await allowed.json();
    assert.equal(body.data.status, 'reversed');
    assert.equal(readProduct(db, 'p-srv-del').quantity, 10);
    const sale = read(db, `verity_sales/${saleId}`);
    assert.equal(sale.isActive, false);
    assert.equal(sale.status, 'reversed');
    assert.equal(sale.deletedBy, 'admin1');

    const repeated = await post('/api/deleteSale', { token: 'token-admin', body: { data: { saleId } } });
    assert.equal(repeated.status, 409);
    assert.equal((await repeated.json()).error.code, 'already-exists');
    assert.equal(readProduct(db, 'p-srv-del').quantity, 10);
  });

  it('answers 503 before authentication when no credentials are configured', async (t) => {
    if (process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      t.skip('credentials present in this environment');
      return;
    }
    const app = createApp();
    let unconfigured;
    await new Promise((resolveListen) => {
      unconfigured = app.listen(0, resolveListen);
    });
    const port = unconfigured.address().port;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      assert.equal(res.status, 200);
      const health = await res.json();
      assert.equal(health.configured, false);

      const call = await fetch(`http://127.0.0.1:${port}/api/createSale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer x' },
        body: JSON.stringify({ data: {} }),
      });
      assert.equal(call.status, 503);
      const body = await call.json();
      assert.equal(body.error.code, 'unavailable');
    } finally {
      await new Promise((done) => unconfigured.close(done));
    }
  });
});

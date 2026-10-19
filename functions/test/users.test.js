const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const createAppUser = require('../src/calls/createAppUser');
const updateAppUser = require('../src/calls/updateAppUser');
const { createFakeDb, fixedNow, seedAdmin, seedSeller, read, ctx } = require('./helpers/seed');

describe('createAppUser / updateAppUser', () => {
  let d;

  const makeAuth = (store) => ({
    getUserByEmail: async (email) => {
      if (store.emails.has(email)) return { uid: store.emails.get(email) };
      const err = new Error('not found');
      err.code = 'auth/user-not-found';
      throw err;
    },
    getUser: async (uid) => {
      if (store.uids.has(uid)) return { uid };
      const err = new Error('not found');
      err.code = 'auth/user-not-found';
      throw err;
    },
    createUser: async ({ email }) => {
      const uid = `uid_${email.split('@')[0]}`;
      store.emails.set(email, uid);
      store.uids.set(uid, true);
      return { uid };
    },
    updateUser: async (uid, fields) => {
      store.updates.push({ uid, fields });
    },
    setCustomUserClaims: async (uid, claims) => {
      store.claims.set(uid, claims);
    },
  });

  beforeEach(() => {
    const db = createFakeDb();
    seedAdmin(db, 'admin1');
    seedAdmin(db, 'admin2', 'Admin Two');
    seedSeller(db, 'seller1');
    const authStore = { emails: new Map(), uids: new Map(), claims: new Map(), updates: [] };
    authStore.emails.set('admin@example.com', 'admin1');
    authStore.emails.set('seller@example.com', 'seller1');
    authStore.uids.set('admin1', true);
    authStore.uids.set('admin2', true);
    authStore.uids.set('seller1', true);
    d = { db, auth: makeAuth(authStore), now: fixedNow, authStore };
  });

  it('creates a seller, generates password, sets claim + profile', async () => {
    const result = await createAppUser(d)({
      email: 'new@example.com',
      name: 'New Seller',
      role: 'seller',
    }, ctx('admin1'));

    assert.ok(result.uid);
    assert.ok(result.generatedPassword && result.generatedPassword.length >= 8);
    const profile = read(d.db, `verity_users/${result.uid}`);
    assert.equal(profile.role, 'seller');
    assert.equal(profile.isActive, true);
    assert.equal(profile.email, 'new@example.com');
    assert.deepEqual(d.authStore.claims.get(result.uid), { role: 'seller' });
  });

  it('accepts a caller-supplied password and returns no generated one', async () => {
    const result = await createAppUser(d)({
      email: 'new2@example.com',
      name: 'Seller Two',
      role: 'seller',
      password: 'password123',
    }, ctx('admin1'));
    assert.equal(result.generatedPassword, null);
  });

  it('rejects duplicate email, invalid role, and short password', async () => {
    await assert.rejects(
      () => createAppUser(d)({ email: 'admin@example.com', name: 'X', role: 'seller' }, ctx('admin1')),
      (e) => e.code === 'invalid-argument',
    );
    await assert.rejects(
      () => createAppUser(d)({ email: 'x@example.com', name: 'X', role: 'superuser' }, ctx('admin1')),
      (e) => e.code === 'invalid-argument',
    );
    await assert.rejects(
      () => createAppUser(d)({ email: 'x@example.com', name: 'X', role: 'seller', password: 'short' }, ctx('admin1')),
      (e) => e.code === 'invalid-argument',
    );
  });

  it('sellers cannot create users', async () => {
    await assert.rejects(
      () => createAppUser(d)({ email: 'x@example.com', name: 'X', role: 'seller' }, ctx('seller1')),
      (e) => e.code === 'permission-denied',
    );
  });

  it('rejects callers whose token role is missing or does not match their profile', async () => {
    await assert.rejects(
      () => createAppUser(d)({ email: 'x@example.com', name: 'X', role: 'seller' }, { auth: { uid: 'admin1' } }),
      (e) => e.code === 'permission-denied',
    );
    await assert.rejects(
      () => createAppUser(d)({ email: 'x@example.com', name: 'X', role: 'seller' }, { auth: { uid: 'admin1', token: { role: 'seller' } } }),
      (e) => e.code === 'permission-denied',
    );
    await assert.rejects(
      () => updateAppUser(d)({ uid: 'seller1', name: 'Renamed' }, { auth: { uid: 'seller1', token: { role: 'admin' } } }),
      (e) => e.code === 'permission-denied',
    );
    assert.equal(read(d.db, 'verity_users/seller1').name, 'Seller');
  });

  it('updates name/role and reflects claims', async () => {
    await updateAppUser(d)({ uid: 'seller1', name: 'Renamed', role: 'admin' }, ctx('admin1'));
    const profile = read(d.db, 'verity_users/seller1');
    assert.equal(profile.name, 'Renamed');
    assert.equal(profile.role, 'admin');
    assert.deepEqual(d.authStore.claims.get('seller1'), { role: 'admin' });
  });

  it('cannot demote the last active admin', async () => {
    d.db.seed('verity_users/admin2', { name: 'Admin Two', role: 'admin', isActive: false });
    await assert.rejects(
      () => updateAppUser(d)({ uid: 'admin1', role: 'seller' }, ctx('admin1')),
      (e) => e.code === 'failed-precondition' && /admin/.test(e.message),
    );
  });

  it('cannot deactivate the last active admin', async () => {
    d.db.seed('verity_users/admin2', { name: 'Admin Two', role: 'admin', isActive: false });
    await assert.rejects(
      () => updateAppUser(d)({ uid: 'admin1', isActive: false }, ctx('admin1')),
      (e) => e.code === 'failed-precondition' && /admin/.test(e.message),
    );
    assert.equal(read(d.db, 'verity_users/admin1').isActive, true);
  });

  it('can demote an admin when another remains', async () => {
    await updateAppUser(d)({ uid: 'admin1', role: 'seller' }, ctx('admin2'));
    assert.equal(read(d.db, 'verity_users/admin1').role, 'seller');
  });

  it('concurrent demotions of the last two admins leave exactly one active admin', async () => {
    const results = await Promise.allSettled([
      updateAppUser(d)({ uid: 'admin1', role: 'seller' }, ctx('admin2')),
      updateAppUser(d)({ uid: 'admin2', role: 'seller' }, ctx('admin1')),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    assert.equal(fulfilled.length, 1, 'exactly one demotion must succeed');
    assert.equal(rejected.length, 1, 'exactly one demotion must be rejected');
    assert.equal(rejected[0].reason.code, 'failed-precondition');
    const survivors = ['admin1', 'admin2']
      .map((uid) => read(d.db, `verity_users/${uid}`))
      .filter((p) => p.role === 'admin' && p.isActive !== false);
    assert.equal(survivors.length, 1);
  });

  it('concurrent deactivations of the last two admins leave exactly one active admin', async () => {
    const results = await Promise.allSettled([
      updateAppUser(d)({ uid: 'admin1', isActive: false }, ctx('admin2')),
      updateAppUser(d)({ uid: 'admin2', isActive: false }, ctx('admin1')),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0].reason.code, 'failed-precondition');
    const survivors = ['admin1', 'admin2']
      .map((uid) => read(d.db, `verity_users/${uid}`))
      .filter((p) => p.role === 'admin' && p.isActive !== false);
    assert.equal(survivors.length, 1);
  });

  it('concurrent mixed demotion and deactivation of the last two admins leaves one active admin', async () => {
    const results = await Promise.allSettled([
      updateAppUser(d)({ uid: 'admin1', role: 'seller' }, ctx('admin2')),
      updateAppUser(d)({ uid: 'admin2', isActive: false }, ctx('admin1')),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0].reason.code, 'failed-precondition');
    const survivors = ['admin1', 'admin2']
      .map((uid) => read(d.db, `verity_users/${uid}`))
      .filter((p) => p.role === 'admin' && p.isActive !== false);
    assert.equal(survivors.length, 1);
  });

  it('deactivating sets disabled on the auth account', async () => {
    await updateAppUser(d)({ uid: 'seller1', isActive: false }, ctx('admin1'));
    assert.equal(read(d.db, 'verity_users/seller1').isActive, false);
    const update = d.authStore.updates.find((u) => u.uid === 'seller1');
    assert.equal(update.fields.disabled, true);
  });

  it('rejects unknown users and unauthenticated callers', async () => {
    await assert.rejects(
      () => updateAppUser(d)({ uid: 'nobody', name: 'X' }, ctx('admin1')),
      (e) => e.code === 'not-found',
    );
    await assert.rejects(
      () => updateAppUser(d)({ uid: 'seller1', name: 'X' }, ctx('seller1')),
      (e) => e.code === 'permission-denied',
    );
  });
});

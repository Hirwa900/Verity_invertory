// Minimal in-memory stand-in for the subset of the Firestore API the callable
// functions use. Supports docs, collections, where-queries, and transactions
// with Firestore-style optimistic concurrency: every committed write bumps a
// per-document version, transactions record the version of everything they
// read (docs and query results), and a transaction whose reads went stale is
// retried from scratch — the same behavior real Firestore enforces.

const clone = (value) => {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
};

class FakeDocRef {
  constructor(store, path) {
    this.store = store;
    this.path = path;
    this.id = path.split('/').pop();
  }
  async get() {
    const data = this.store.docs.get(this.path);
    return { exists: data !== undefined, data: () => clone(data), id: this.id, ref: this };
  }
  async set(data) {
    this.store.write(this.path, 'set', clone(data));
  }
  async update(data) {
    if (!this.store.docs.has(this.path)) throw new Error(`No document to update: ${this.path}`);
    this.store.write(this.path, 'update', clone(data));
  }
  async delete() {
    this.store.write(this.path, 'delete');
  }
}

class FakeQuery {
  constructor(store, path, filters = []) {
    this.store = store;
    this.path = path;
    this.filters = filters;
  }
  where(field, op, value) {
    return new FakeQuery(this.store, this.path, [...this.filters, { field, op, value }]);
  }
  _matches() {
    const prefix = `${this.path}/`;
    const matches = [];
    this.store.docs.forEach((data, path) => {
      if (!path.startsWith(prefix)) return;
      const ok = this.filters.every(({ field, op, value }) => {
        const actual = data ? data[field] : undefined;
        if (op === '==') return actual === value;
        if (op === '!=') return actual !== value;
        if (op === '>=') return actual >= value;
        if (op === '<=') return actual <= value;
        throw new Error(`Unsupported operator ${op}`);
      });
      if (ok) matches.push({ id: path.split('/').pop(), data: () => clone(data), ref: new FakeDocRef(this.store, path) });
    });
    return matches;
  }
  async get() {
    const matches = this._matches();
    return { size: matches.length, docs: matches, empty: matches.length === 0, forEach: (fn) => matches.forEach(fn) };
  }
}

class FakeTransaction {
  constructor(store) {
    this.store = store;
    this.writes = [];
    this.reads = [];
  }
  async get(refOrQuery) {
    if (refOrQuery instanceof FakeQuery) {
      const matches = refOrQuery._matches();
      matches.forEach((m) => this.reads.push({ path: m.ref.path, version: this.store.version(m.ref.path) }));
      return { size: matches.length, docs: matches, empty: matches.length === 0, forEach: (fn) => matches.forEach(fn) };
    }
    this.reads.push({ path: refOrQuery.path, version: this.store.version(refOrQuery.path) });
    const data = this.store.docs.get(refOrQuery.path);
    return { exists: data !== undefined, data: () => clone(data), id: refOrQuery.id, ref: refOrQuery };
  }
  set(ref, data) {
    this.writes.push({ path: ref.path, type: 'set', data: clone(data) });
  }
  update(ref, data) {
    this.writes.push({ path: ref.path, type: 'update', data: clone(data) });
  }
  delete(ref) {
    this.writes.push({ path: ref.path, type: 'delete' });
  }
  _isStale() {
    return this.reads.some(({ path, version }) => this.store.version(path) !== version);
  }
  _commit() {
    this.writes.forEach((write) => {
      this.store.write(write.path, write.type, write.data, { alreadyCloned: true });
    });
  }
}

const createFakeDb = () => {
  let idCounter = 0;
  const store = {
    docs: new Map(),
    versions: new Map(),
    version: (path) => store.versions.get(path) || 0,
    write: (path, type, data, opts = {}) => {
      if (type === 'delete') {
        store.docs.delete(path);
      } else if (type === 'update') {
        const existing = store.docs.get(path);
        store.docs.set(path, { ...(existing || {}), ...(opts.alreadyCloned ? data : clone(data)) });
      } else {
        store.docs.set(path, opts.alreadyCloned ? data : clone(data));
      }
      store.versions.set(path, store.version(path) + 1);
    },
  };
  const db = {
    doc: (path) => new FakeDocRef(store, path),
    collection: (path) => {
      const ref = new FakeQuery(store, path);
      ref.doc = (id) => {
        const docId = id || `gen_${++idCounter}`;
        return new FakeDocRef(store, `${path}/${docId}`);
      };
      return ref;
    },
    runTransaction: async (fn, options = {}) => {
      const maxAttempts = options.maxAttempts || 5;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const tx = new FakeTransaction(store);
        const result = await fn(tx);
        if (tx._isStale() && attempt < maxAttempts) continue;
        if (tx._isStale()) throw new Error('FakeFirestore: transaction conflict (max attempts exceeded)');
        tx._commit();
        return result;
      }
      throw new Error('FakeFirestore: transaction conflict');
    },
    seed: (path, data) => store.write(path, 'set', data),
    dump: () => clone(Object.fromEntries(store.docs)),
  };
  return db;
};

module.exports = { createFakeDb, FakeTransaction };

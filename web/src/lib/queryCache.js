// Shared read cache for expensive, rarely-changing Firestore lists (products,
// categories). It makes page navigation cheap: revisiting Products, Stock, New
// Sale, or New Purchase re-uses one read instead of re-downloading the whole
// collection each time.
//
// Safety rules:
//   * Every successful business write bumps the revision (see functions.js and
//     the pages that write directly), which invalidates every cached entry, so
//     stock and prices never stay stale after an operation in this session.
//   * Entries also expire after TTL_MS, which bounds staleness for writes made
//     by another user in another session.
//   * Concurrent callers for the same key share one in-flight request, so a
//     page never issues duplicate reads for the same data.
//   * Failed loads are never cached.

const TTL_MS = 30 * 1000;

let revision = 0;
const cache = new Map();

export function dataRevision() {
  return revision;
}

export function bumpDataRevision() {
  revision += 1;
  cache.clear();
}

export function cachedRead(key, loader) {
  const now = Date.now();
  const startedRev = revision;
  const hit = cache.get(key);

  if (hit) {
    if (hit.promise) return hit.promise;
    if (hit.revision === startedRev && now - hit.at < TTL_MS) {
      return Promise.resolve(hit.value);
    }
  }

  let raw;
  try {
    raw = loader();
  } catch (error) {
    return Promise.reject(error);
  }

  const p = Promise.resolve(raw)
    .then((value) => {
      cache.set(key, { value, at: Date.now(), revision: startedRev });
      return value;
    })
    .catch((error) => {
      if (cache.get(key) && cache.get(key).promise === p) {
        cache.delete(key);
      }
      throw error;
    });

  cache.set(key, { promise: p, at: now, revision: startedRev });
  return p;
}

// Test helper: drops every cached entry without touching the revision counter.
export function clearReadCache() {
  cache.clear();
}

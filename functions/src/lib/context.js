const { denied, unauthenticated, invalid } = require('./errors');

const requireUser = async (db, authContext) => {
  if (!authContext || !authContext.uid) throw unauthenticated();
  const snap = await db.doc(`verity_users/${authContext.uid}`).get();
  const profile = snap.exists ? snap.data() : null;
  if (!profile || profile.isActive !== true) {
    throw denied('Account is inactive or missing. Contact an administrator.');
  }
  const claimRole = authContext.token ? authContext.token.role : undefined;
  if (!claimRole || claimRole !== profile.role) {
    throw denied('Your access level is out of date. Sign out and sign in again.');
  }
  return { uid: authContext.uid, name: profile.name || '', role: profile.role };
};

const requireRole = (user, roles) => {
  if (!roles.includes(user.role)) throw denied();
  return user;
};

const requireSaleId = (data) => {
  const saleId = String((data && data.saleId) || '').trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(saleId)) throw invalid('A valid sale id is required.');
  return saleId;
};

const requireProductRef = async (db, t, productId) => {
  const ref = db.doc(`verity_products/${productId}`);
  const snap = await t.get(ref);
  if (!snap.exists) throw notFoundProduct();
  return { ref, data: snap.data() };
};

const notFoundProduct = () => new (require('./errors').HttpsError)('not-found', 'Product not found.');

const normalizeItems = (data, { requireUnitCost = false } = {}) => {
  const items = data && Array.isArray(data.items) ? data.items : null;
  if (!items || items.length === 0) throw invalid('At least one item is required.');
  if (items.length > 200) throw invalid('Too many items in one request.');
  const seen = new Set();
  const normalized = items.map((item) => {
    const productId = String((item && item.productId) || '').trim();
    const quantity = Number(item && item.quantity);
    if (!productId) throw invalid('Each item needs a product.');
    if (!Number.isSafeInteger(quantity) || quantity <= 0) throw invalid('Item quantities must be positive whole numbers.');
    if (seen.has(productId)) throw invalid('Each product can appear only once. Combine quantities on one line.');
    seen.add(productId);
    const unitCostCents = requireUnitCost ? Number(item && item.unitCostCents) : null;
    if (requireUnitCost && (!Number.isSafeInteger(unitCostCents) || unitCostCents < 0)) {
      throw invalid('Each item needs a valid unit cost.');
    }
    return { productId, quantity, unitCostCents };
  });
  return normalized;
};

module.exports = { requireUser, requireRole, requireSaleId, requireProductRef, normalizeItems };

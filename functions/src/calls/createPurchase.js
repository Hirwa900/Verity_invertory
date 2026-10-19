const { requireUser, requireRole, normalizeItems } = require('../lib/context');
const { invalid } = require('../lib/errors');
const { isDateOnly, getBusinessDate } = require('../lib/businessDate');

module.exports = ({ db, now }) => async (data, context) => {
  const user = requireRole(await requireUser(db, context && context.auth), ['admin']);
  const items = normalizeItems(data, { requireUnitCost: true });

  const clientRequestId = String((data && data.clientRequestId) || '').trim();
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(clientRequestId)) {
    throw invalid('A unique client request id is required.');
  }

  const businessDate = data && data.businessDate != null ? String(data.businessDate) : getBusinessDate();
  if (!isDateOnly(businessDate)) throw invalid('A valid purchase date is required.');

  return db.runTransaction(async (t) => {
    const idemRef = db.doc(`verity_idempotency/${clientRequestId}`);
    const idemSnap = await t.get(idemRef);
    if (idemSnap.exists) {
      throw invalid('This purchase was already submitted.');
    }

    const productRefs = items.map((item) => db.doc(`verity_products/${item.productId}`));
    const productSnaps = await Promise.all(productRefs.map((ref) => t.get(ref)));

    let totalCents = 0;
    const purchaseItems = [];
    productSnaps.forEach((snap, index) => {
      if (!snap.exists) throw invalid('One of the selected products no longer exists.');
      const product = snap.data();
      const item = items[index];
      if (product.isActive === false) throw invalid(`"${product.name}" is no longer active.`);
      const subtotalCents = item.unitCostCents * item.quantity;
      totalCents += subtotalCents;
      purchaseItems.push({
        productId: productRefs[index].id,
        productName: product.name,
        quantity: item.quantity,
        unitCostCents: item.unitCostCents,
        subtotalCents,
      });
    });

    const purchaseRef = db.collection('verity_purchases').doc();
    productSnaps.forEach((snap, index) => {
      const product = snap.data();
      const item = items[index];
      t.update(productRefs[index], {
        quantity: Number(product.quantity) + item.quantity,
        buyingPriceCents: item.unitCostCents,
        updatedAt: now(),
      });
      t.set(db.collection('verity_stockMovements').doc(), {
        productId: productRefs[index].id,
        productName: product.name,
        userId: user.uid,
        userName: user.name,
        type: 'PURCHASE',
        quantity: item.quantity,
        referenceId: purchaseRef.id,
        note: '',
        createdAt: now(),
      });
    });

    t.set(purchaseRef, {
      userId: user.uid,
      userName: user.name,
      businessDate,
      purchaseTimestamp: now(),
      totalCents,
      items: purchaseItems,
      clientRequestId,
      createdAt: now(),
    });
    t.set(idemRef, { purchaseId: purchaseRef.id, uid: user.uid, createdAt: now() });
    t.set(db.collection('verity_auditEvents').doc(), {
      actorId: user.uid,
      actorName: user.name,
      action: 'purchase.create',
      details: { purchaseId: purchaseRef.id, totalCents },
      createdAt: now(),
    });

    return { purchaseId: purchaseRef.id, totalCents };
  });
};

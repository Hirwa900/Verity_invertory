const { requireUser, requireRole, normalizeItems } = require('../lib/context');
const { invalid } = require('../lib/errors');
const { isDateOnly, getBusinessDate } = require('../lib/businessDate');

module.exports = ({ db, now }) => async (data, context) => {
  const user = requireRole(await requireUser(db, context && context.auth), ['admin', 'seller']);
  const items = normalizeItems(data);

  const clientRequestId = String((data && data.clientRequestId) || '').trim();
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(clientRequestId)) {
    throw invalid('A unique client request id is required.');
  }

  const businessDate = data && data.businessDate != null ? String(data.businessDate) : getBusinessDate();
  if (!isDateOnly(businessDate)) throw invalid('A valid sale date is required.');

  return db.runTransaction(async (t) => {
    const idemRef = db.doc(`verity_idempotency/${clientRequestId}`);
    const idemSnap = await t.get(idemRef);
    if (idemSnap.exists) {
      throw invalid('This sale was already submitted.');
    }

    const productRefs = items.map((item) => db.doc(`verity_products/${item.productId}`));
    const productSnaps = await Promise.all(productRefs.map((ref) => t.get(ref)));

    let totalCents = 0;
    const saleItems = [];
    productSnaps.forEach((snap, index) => {
      if (!snap.exists) throw invalid('One of the selected products no longer exists.');
      const product = snap.data();
      const item = items[index];
      if (product.isActive === false) throw invalid(`"${product.name}" is no longer active.`);
      if (Number(product.quantity) < item.quantity) {
        throw invalid(`Insufficient stock for "${product.name}" (have ${Number(product.quantity)}, need ${item.quantity}).`);
      }
      const subtotalCents = Number(product.sellingPriceCents) * item.quantity;
      const costCents = Number(product.buyingPriceCents) * item.quantity;
      totalCents += subtotalCents;
      saleItems.push({
        productId: productRefs[index].id,
        productName: product.name,
        quantity: item.quantity,
        unitPriceCents: Number(product.sellingPriceCents),
        buyingPriceCents: Number(product.buyingPriceCents),
        subtotalCents,
        profitCents: subtotalCents - costCents,
      });
    });

    const saleRef = db.collection('verity_sales').doc();
    productSnaps.forEach((snap, index) => {
      const product = snap.data();
      const item = items[index];
      t.update(productRefs[index], {
        quantity: Number(product.quantity) - item.quantity,
        updatedAt: now(),
      });
      t.set(db.collection('verity_stockMovements').doc(), {
        productId: productRefs[index].id,
        productName: product.name,
        userId: user.uid,
        userName: user.name,
        type: 'SALE',
        quantity: item.quantity,
        referenceId: saleRef.id,
        note: '',
        createdAt: now(),
      });
    });

    t.set(saleRef, {
      userId: user.uid,
      userName: user.name,
      businessDate,
      saleTimestamp: now(),
      totalCents,
      isActive: true,
      clientRequestId,
      items: saleItems,
      createdAt: now(),
      archivedAt: null,
    });
    t.set(idemRef, { saleId: saleRef.id, uid: user.uid, createdAt: now() });
    t.set(db.collection('verity_auditEvents').doc(), {
      actorId: user.uid,
      actorName: user.name,
      action: 'sale.create',
      details: { saleId: saleRef.id, totalCents },
      createdAt: now(),
    });

    return { saleId: saleRef.id, totalCents };
  });
};

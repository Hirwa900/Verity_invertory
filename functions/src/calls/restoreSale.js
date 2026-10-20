const { requireUser, requireRole, requireSaleId } = require('../lib/context');
const { notFound, failed, invalid } = require('../lib/errors');

module.exports = ({ db, now }) => async (data, context) => {
  const user = requireRole(await requireUser(db, context && context.auth), ['admin']);
  const saleId = requireSaleId(data);

  return db.runTransaction(async (t) => {
    const saleRef = db.doc(`verity_sales/${saleId}`);
    const saleSnap = await t.get(saleRef);
    if (!saleSnap.exists) throw notFound('Sale not found.');
    const sale = saleSnap.data();
    if (sale.isActive !== false) throw invalid('Only archived sales can be restored.');

    const items = Array.isArray(sale.items) ? sale.items : [];
    const productRefs = items.map((item) => db.doc(`verity_products/${item.productId}`));
    const productSnaps = await Promise.all(productRefs.map((ref) => t.get(ref)));

    productSnaps.forEach((snap, index) => {
      if (!snap.exists) throw failed('A product from this sale no longer exists; restore is not possible.');
      const product = snap.data();
      const item = items[index];
      if (Number(product.quantity) < Number(item.quantity)) {
        throw invalid(`Insufficient stock to restore "${product.name}" (have ${Number(product.quantity)}, need ${Number(item.quantity)}).`);
      }
    });

    productSnaps.forEach((snap, index) => {
      const product = snap.data();
      const item = items[index];
      t.update(productRefs[index], {
        quantity: Number(product.quantity) - Number(item.quantity),
        updatedAt: now(),
      });
      t.set(db.collection('verity_stockMovements').doc(), {
        productId: item.productId,
        productName: item.productName,
        userId: user.uid,
        userName: user.name,
        type: 'SALE',
        quantity: Number(item.quantity),
        referenceId: saleId,
        note: `Sale #${saleId} restored from archive`,
        createdAt: now(),
      });
    });

    t.set(db.collection('verity_auditEvents').doc(), {
      actorId: user.uid,
      actorName: user.name,
      action: 'sale.restore',
      details: { saleId },
      createdAt: now(),
    });

    t.update(saleRef, {
      isActive: true,
      archivedAt: null,
      status: null,
      deletedAt: null,
      deletedBy: null,
      deletedByName: null,
    });
    return { saleId };
  });
};

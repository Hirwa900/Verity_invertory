const { requireUser, requireRole, requireSaleId } = require('../lib/context');
const { notFound, conflict } = require('../lib/errors');

module.exports = ({ db, now }) => async (data, context) => {
  const user = requireRole(await requireUser(db, context && context.auth), ['admin']);
  const saleId = requireSaleId(data);

  return db.runTransaction(async (t) => {
    const saleRef = db.doc(`verity_sales/${saleId}`);
    const saleSnap = await t.get(saleRef);
    if (!saleSnap.exists) throw notFound('Sale not found.');
    const sale = saleSnap.data();
    if (sale.isActive === false) throw conflict('This sale has already been archived.');

    const items = Array.isArray(sale.items) ? sale.items : [];
    for (const item of items) {
      const productRef = db.doc(`verity_products/${item.productId}`);
      const productSnap = await t.get(productRef);
      if (!productSnap.exists) continue;
      const product = productSnap.data();
      t.update(productRef, {
        quantity: Number(product.quantity) + Number(item.quantity),
        updatedAt: now(),
      });
      t.set(db.collection('verity_stockMovements').doc(), {
        productId: item.productId,
        productName: item.productName,
        userId: user.uid,
        userName: user.name,
        type: 'RETURN',
        quantity: Number(item.quantity),
        referenceId: saleId,
        note: `Sale #${saleId} archived`,
        createdAt: now(),
      });
    }

    t.set(db.collection('verity_auditEvents').doc(), {
      actorId: user.uid,
      actorName: user.name,
      action: 'sale.archive',
      details: { saleId, itemsReturned: items.length },
      createdAt: now(),
    });

    t.update(saleRef, { isActive: false, archivedAt: now() });
    return { saleId, itemsReturned: items.length };
  });
};

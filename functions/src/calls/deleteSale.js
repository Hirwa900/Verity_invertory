// Secure "Delete Sale": a server-side, admin-only reversal of a sale.
//
// The sale record is never erased. It is soft-deleted (isActive=false) and
// stamped with reversal markers (status/deletedBy/deletedAt) plus a
// verity_auditEvents entry, so the original sale, who reversed it, and when
// are preserved. Stock is returned to inventory and RETURN movements are
// logged in the same Firestore transaction as the status flip, so reports,
// dashboard statistics, and stock can never drift apart. A sale that is
// already reversed (isActive=false or status='reversed') is rejected with
// 'already-exists', so retried or duplicate delete requests cannot restore
// stock twice.

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
    if (sale.isActive === false || sale.status === 'reversed') {
      throw conflict('This sale has already been deleted and reversed.');
    }

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
        note: `Sale #${saleId} deleted (reversed)`,
        createdAt: now(),
      });
    }

    t.set(db.collection('verity_auditEvents').doc(), {
      actorId: user.uid,
      actorName: user.name,
      action: 'sale.delete',
      details: {
        saleId,
        itemsReturned: items.length,
        totalCents: Number(sale.totalCents) || 0,
        businessDate: sale.businessDate,
        originalSaleBy: sale.userId,
      },
      createdAt: now(),
    });

    t.update(saleRef, {
      isActive: false,
      status: 'reversed',
      deletedAt: now(),
      deletedBy: user.uid,
      deletedByName: user.name,
    });

    return { saleId, itemsReturned: items.length, status: 'reversed' };
  });
};

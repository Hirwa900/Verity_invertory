const { requireUser, requireRole, requireProductRef } = require('../lib/context');
const { invalid } = require('../lib/errors');

module.exports = ({ db, now }) => async (data, context) => {
  const user = requireRole(await requireUser(db, context && context.auth), ['admin']);

  const productId = String((data && data.productId) || '').trim();
  if (!productId) throw invalid('A product is required.');
  const quantityChange = Number(data && data.quantityChange);
  if (!Number.isSafeInteger(quantityChange) || quantityChange === 0) {
    throw invalid('Quantity change must be a non-zero whole number.');
  }
  const reason = String((data && data.reason) || '').trim().slice(0, 200);

  return db.runTransaction(async (t) => {
    const { ref, data: product } = await requireProductRef(db, t, productId);
    if (product.isActive === false) throw invalid(`"${product.name}" is no longer active.`);

    const newQuantity = Number(product.quantity) + quantityChange;
    if (newQuantity < 0) {
      throw invalid(`Adjustment would make stock negative for "${product.name}" (have ${Number(product.quantity)}, change ${quantityChange}).`);
    }

    t.update(ref, { quantity: newQuantity, updatedAt: now() });
    const movementRef = db.collection('verity_stockMovements').doc();
    t.set(movementRef, {
      productId,
      productName: product.name,
      userId: user.uid,
      userName: user.name,
      type: 'ADJUSTMENT',
      quantity: quantityChange,
      referenceId: null,
      note: reason,
      createdAt: now(),
    });
    t.set(db.collection('verity_auditEvents').doc(), {
      actorId: user.uid,
      actorName: user.name,
      action: 'stock.adjust',
      details: { productId, quantityChange, reason },
      createdAt: now(),
    });

    return { movementId: movementRef.id, newQuantity };
  });
};

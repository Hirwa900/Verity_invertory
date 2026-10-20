import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listProducts } from '../lib/collections';
import { call, friendlyFunctionMessage } from '../lib/functions';
import { formatRWF, parseToCents } from '../lib/money';
import getBusinessDate from '../lib/businessDate';

const EMPTY_ITEM = { productId: '', quantity: 1, unitCost: '' };

// Validates the purchase rows and drops rows where nothing was selected, so an
// extra untouched line can never block a purchase (the per-row delete control
// was intentionally removed from this page). Rows with a product selected must
// still carry a valid cost and quantity, and each product may appear once.
export function preparePurchaseItems(items) {
  const chosen = items.filter((item) => item.productId);
  if (chosen.length === 0) throw new Error('Select at least one product.');
  const seen = new Set();
  return chosen.map((item) => {
    if (seen.has(item.productId)) {
      throw new Error('The same product is on more than one line. Combine the quantities into a single line.');
    }
    seen.add(item.productId);
    const unitCostCents = parseToCents(item.unitCost);
    if (!Number.isSafeInteger(unitCostCents)) throw new Error('Each item needs a valid unit cost.');
    const quantity = Number(item.quantity);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('Quantities must be positive whole numbers.');
    return { productId: item.productId, quantity, unitCostCents };
  });
}

export function buildPurchasePayload(items, businessDate, clientRequestId) {
  if (!clientRequestId) throw new Error('A unique client request id is required.');
  return { items: preparePurchaseItems(items), businessDate, clientRequestId };
}

export default function NewPurchasePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSeller = user?.role === 'seller';
  const [purchaseDate, setPurchaseDate] = useState(getBusinessDate());
  const [items, setItems] = useState([EMPTY_ITEM]);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const loadProducts = () => listProducts();

  useEffect(() => {
    loadProducts()
      .then(setProducts)
      .catch(() => setError('Unable to load products.'))
      .finally(() => setLoadingProducts(false));
  }, []);

  const getProduct = (id) => products.find((p) => p.id === id);

  const handleProductChange = (index, productId) => {
    const product = getProduct(productId);
    setItems((prev) => prev.map((item, i) =>
      i === index ? { ...item, productId, unitCost: product ? (product.buyingPriceCents / 100).toString() : '', quantity: 1 } : item));
  };

  const handleChange = (index, field, value) =>
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));

  const addItem = () => setItems((prev) => [...prev, EMPTY_ITEM]);

  const totalCents = items.reduce((sum, item) => sum + (parseToCents(item.unitCost) || 0) * (Number(item.quantity) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const payload = buildPurchasePayload(items, purchaseDate, crypto.randomUUID());
      await call('createPurchase', payload);
      setSuccess('Purchase recorded! Stock updated.');
      setItems([EMPTY_ITEM]);
      setPurchaseDate(getBusinessDate());
      loadProducts()
        .then(setProducts)
        .catch(() => {});
    } catch (err) {
      setError(friendlyFunctionMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (isSeller) {
    return (
      <div className="inner-page">
        <div className="inner-page-card">
          <p className="page-message">Only administrators can record purchases.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="inner-page">
      <div className="inner-page-card">
        <div className="inner-page-header">
          <div className="seller-page-actions">
            <button type="button" className="back-btn" onClick={() => navigate('/dashboard')}>← Dashboard</button>
          </div>
          <h1>New Purchase</h1>
          <p className="page-sub">Record incoming stock. Quantities will be updated automatically.</p>
        </div>

        <form onSubmit={handleSubmit} className="sale-form">
          <div className="form-row">
            <div className="field-group">
              <label>Purchase Date</label>
              <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} required />
            </div>
          </div>

          <div className="items-section">
            <h2 className="items-title">Items Purchased</h2>
            {loadingProducts ? (
              <p className="loading-msg">Loading products…</p>
            ) : (
              <>
                {items.map((item, index) => {
                  const product = getProduct(item.productId);
                  return (
                    <div key={index} className="sale-item-row">
                      <div className="sale-item-fields">
                        <div className="field-group" style={{ flex: 2 }}>
                          <label>Product</label>
                          <select value={item.productId} onChange={(e) => handleProductChange(index, e.target.value)}>
                            <option value="">— Select product —</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} {p.categoryName ? `(${p.categoryName})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="field-group">
                          <label>Qty</label>
                          <input type="number" min="1" step="1" value={item.quantity}
                            onChange={(e) => handleChange(index, 'quantity', e.target.value)} />
                        </div>

                        <div className="field-group">
                          <label>Unit Cost (RWF)</label>
                          <input type="number" step="0.01" min="0" value={item.unitCost}
                            onChange={(e) => handleChange(index, 'unitCost', e.target.value)} placeholder="0" />
                        </div>

                        <div className="field-group">
                          <label>Subtotal</label>
                          <div className="price-display subtotal">
                            RWF {formatRWF((parseToCents(item.unitCost) || 0) * (Number(item.quantity) || 0))}
                          </div>
                        </div>
                      </div>

                      {product && (
                        <div className="stock-hint">
                          Current stock: {product.quantity} {product.unit || 'pcs'} → After: {product.quantity + Number(item.quantity || 0)}
                        </div>
                      )}
                    </div>
                  );
                })}

                <button type="button" className="add-item-btn" onClick={addItem}>+ Add another product</button>

                <div className="sale-total-row">
                  <span>Total Cost</span>
                  <span className="sale-total-value">RWF {formatRWF(totalCents)}</span>
                </div>
              </>
            )}
          </div>

          {error && <div className="form-error-box">{error}</div>}
          {success && <div className="form-success-box">{success}</div>}

          <div className="form-actions-row">
            <button type="button" className="btn-secondary" onClick={() => navigate('/dashboard')}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting || loadingProducts}>
              {submitting ? 'Saving…' : 'Record Purchase'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

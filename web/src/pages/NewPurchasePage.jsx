import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listProducts } from '../lib/collections';
import { call, friendlyFunctionMessage } from '../lib/functions';
import { formatRWF, parseToCents } from '../lib/money';
import getBusinessDate from '../lib/businessDate';

export default function NewPurchasePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isSeller = user?.role === 'seller';
  const [purchaseDate, setPurchaseDate] = useState(getBusinessDate());
  const [items, setItems] = useState([{ productId: '', quantity: 1, unitCost: '' }]);
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

  const addItem = () => setItems((prev) => [...prev, { productId: '', quantity: 1, unitCost: '' }]);
  const removeItem = (index) => setItems((prev) => prev.filter((_, i) => i !== index));

  const totalCents = items.reduce((sum, item) => sum + (parseToCents(item.unitCost) || 0) * (Number(item.quantity) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const payloadItems = items
        .filter((i) => i.productId)
        .map((i) => {
          const unitCostCents = parseToCents(i.unitCost);
          if (!Number.isSafeInteger(unitCostCents)) throw new Error('Each item needs a valid unit cost.');
          const quantity = Number(i.quantity);
          if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('Quantities must be positive whole numbers.');
          return { productId: i.productId, quantity, unitCostCents };
        });
      await call('createPurchase', { items: payloadItems, businessDate: purchaseDate });
      setSuccess('Purchase recorded! Stock updated.');
      setItems([{ productId: '', quantity: 1, unitCost: '' }]);
      setPurchaseDate(getBusinessDate());
      setProducts(await loadProducts());
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
            <button type="button" className="seller-logout-btn" onClick={() => { logout(); navigate('/login'); }}>Logout</button>
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
                          <select value={item.productId} onChange={(e) => handleProductChange(index, e.target.value)} required>
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
                            onChange={(e) => handleChange(index, 'quantity', e.target.value)} required />
                        </div>

                        <div className="field-group">
                          <label>Unit Cost (RWF)</label>
                          <input type="number" step="0.01" min="0" value={item.unitCost}
                            onChange={(e) => handleChange(index, 'unitCost', e.target.value)} placeholder="0" required />
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

                      {items.length > 1 && (
                        <button type="button" className="remove-item-btn" onClick={() => removeItem(index)}>✕ Remove</button>
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

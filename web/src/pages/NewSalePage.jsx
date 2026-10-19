import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listProducts } from '../lib/collections';
import { call, friendlyFunctionMessage } from '../lib/functions';
import { formatRWF } from '../lib/money';
import getBusinessDate from '../lib/businessDate';

export default function NewSalePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isSeller = user?.role === 'seller';
  const [saleDate, setSaleDate] = useState(getBusinessDate());
  const [items, setItems] = useState([{ productId: '', quantity: 1 }]);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const loadProducts = () => listProducts({ activeOnly: true });

  useEffect(() => {
    loadProducts()
      .then(setProducts)
      .catch(() => setError('Unable to load products.'))
      .finally(() => setLoadingProducts(false));
  }, []);

  const getProduct = (id) => products.find((p) => p.id === id);

  const handleProductChange = (index, productId) => {
    if (productId && items.some((item, i) => i !== index && item.productId === productId)) {
      setError('A product can only be added once. Update its quantity on the existing line.');
      return;
    }
    setError(null);
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, productId, quantity: 1 } : item)));
  };

  const handleQtyChange = (index, qty) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, quantity: Math.max(1, Number(qty)) } : item)));
  };

  const addItem = () => setItems((prev) => [...prev, { productId: '', quantity: 1 }]);
  const removeItem = (index) => setItems((prev) => prev.filter((_, i) => i !== index));

  const totalCents = items.reduce((sum, item) => {
    const p = getProduct(item.productId);
    return sum + (p ? p.sellingPriceCents * item.quantity : 0);
  }, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      await call('createSale', {
        items: items
          .filter((i) => i.productId)
          .map((i) => ({ productId: i.productId, quantity: Number(i.quantity) })),
        businessDate: saleDate,
        clientRequestId: crypto.randomUUID(),
      });
      setSuccess('Sale recorded successfully!');
      setItems([{ productId: '', quantity: 1 }]);
      setSaleDate(getBusinessDate());
      setProducts(await loadProducts());
    } catch (err) {
      setError(friendlyFunctionMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="inner-page">
      <div className="inner-page-card">
        <div className="inner-page-header">
          <div className="seller-page-actions">
            <button type="button" className="back-btn" onClick={() => navigate(isSeller ? '/sales' : '/dashboard')}>
              {isSeller ? '← Sales History' : '← Dashboard'}
            </button>
            {isSeller && <button type="button" className="seller-logout-btn" onClick={() => { logout(); navigate('/login'); }}>Logout</button>}
          </div>
          <h1>New Sale</h1>
          <p className="page-sub">Search for a product to see its price, then record the sale.</p>
        </div>

        <form onSubmit={handleSubmit} className="sale-form">
          <div className="form-row">
            <div className="field-group">
              <label>Sale Date</label>
              <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} required />
            </div>
          </div>

          <div className="items-section">
            <h2 className="items-title">Sale Items</h2>
            {loadingProducts ? (
              <p className="loading-msg">Loading products…</p>
            ) : (
              <>
                {items.map((item, index) => {
                  const product = getProduct(item.productId);
                  const stockOk = product ? product.quantity >= item.quantity : true;
                  return (
                    <div key={index} className="sale-item-row">
                      <div className="sale-item-fields">
                        <div className="field-group" style={{ flex: 2 }}>
                          <label>Product</label>
                          <select
                            value={item.productId}
                            onChange={(e) => handleProductChange(index, e.target.value)}
                            required
                          >
                            <option value="">— Select product —</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} {p.categoryName ? `(${p.categoryName})` : ''} · {p.sku || `#${p.id}`} · FRW {formatRWF(p.sellingPriceCents, { decimals: 2 })}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="field-group">
                          <label>Qty</label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            max={product ? product.quantity : undefined}
                            value={item.quantity}
                            onChange={(e) => handleQtyChange(index, e.target.value)}
                            required
                          />
                        </div>

                        <div className="field-group">
                          <label>Sell Price (FRW)</label>
                          <div className="price-display">
                            {product ? `FRW ${formatRWF(product.sellingPriceCents, { decimals: 2 })}` : '—'}
                          </div>
                        </div>

                        <div className="field-group">
                          <label>Subtotal (FRW)</label>
                          <div className="price-display subtotal">
                            {product ? `FRW ${formatRWF(product.sellingPriceCents * item.quantity, { decimals: 2 })}` : '—'}
                          </div>
                        </div>
                      </div>

                      {product && (
                        <div className={`stock-hint ${!stockOk ? 'stock-hint-warn' : ''}`}>
                          {stockOk ? `✓ ${product.quantity} in stock` : `⚠ Only ${product.quantity} in stock!`}
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
                  <span>Total sale amount to collect</span>
                  <span className="sale-total-value">FRW {formatRWF(totalCents, { decimals: 2 })}</span>
                </div>
              </>
            )}
          </div>

          {error && <div className="form-error-box">{error}</div>}
          {success && <div className="form-success-box">{success}</div>}

          <div className="form-actions-row">
            <button type="button" className="btn-secondary" onClick={() => navigate(isSeller ? '/sales' : '/dashboard')}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting || loadingProducts}>
              {submitting ? 'Saving…' : 'Record Sale'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

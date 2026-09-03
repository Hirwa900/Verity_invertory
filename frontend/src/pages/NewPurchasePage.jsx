import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = '/api';

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export default function NewPurchasePage() {
  const navigate = useNavigate();
  const [purchaseDate, setPurchaseDate] = useState(todayStr());
  const [items, setItems] = useState([{ product_id: '', quantity: 1, buying_price: '' }]);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) { setError('Not logged in.'); setLoadingProducts(false); return; }
    axios.get(`${API}/products`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setProducts(r.data))
      .catch(() => setError('Unable to load products.'))
      .finally(() => setLoadingProducts(false));
  }, []);

  const getProduct = (id) => products.find((p) => p.id === Number(id));

  const handleProductChange = (index, productId) => {
    const product = products.find((p) => p.id === Number(productId));
    setItems((prev) => prev.map((item, i) =>
      i === index ? { ...item, product_id: productId, buying_price: product?.buying_price ?? '', quantity: 1 } : item
    ));
  };

  const handleChange = (index, field, value) => {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const addItem = () => setItems((prev) => [...prev, { product_id: '', quantity: 1, buying_price: '' }]);
  const removeItem = (index) => setItems((prev) => prev.filter((_, i) => i !== index));

  const total = items.reduce((sum, item) => {
    return sum + (Number(item.buying_price) || 0) * (Number(item.quantity) || 0);
  }, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    const token = localStorage.getItem('authToken');
    try {
      await axios.post(`${API}/purchases`, {
        purchase_date: purchaseDate,
        items: items.map((i) => ({
          product_id: Number(i.product_id),
          quantity: Number(i.quantity),
          buying_price: Number(i.buying_price),
        })),
      }, { headers: { Authorization: `Bearer ${token}` } });
      setSuccess('Purchase recorded! Stock updated.');
      setItems([{ product_id: '', quantity: 1, buying_price: '' }]);
      setPurchaseDate(todayStr());
      // Refresh products to show updated quantities
      const r = await axios.get(`${API}/products`, { headers: { Authorization: `Bearer ${token}` } });
      setProducts(r.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to record purchase.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="inner-page">
      <div className="inner-page-card">
        <div className="inner-page-header">
          <button type="button" className="back-btn" onClick={() => navigate('/dashboard')}>← Dashboard</button>
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
                  const product = getProduct(item.product_id);
                  return (
                    <div key={index} className="sale-item-row">
                      <div className="sale-item-fields">
                        <div className="field-group" style={{ flex: 2 }}>
                          <label>Product</label>
                          <select
                            value={item.product_id}
                            onChange={(e) => handleProductChange(index, e.target.value)}
                            required
                          >
                            <option value="">— Select product —</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} {p.category_name ? `(${p.category_name})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="field-group">
                          <label>Qty</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleChange(index, 'quantity', e.target.value)}
                            required
                          />
                        </div>

                        <div className="field-group">
                          <label>Buying Price (RWF)</label>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={item.buying_price}
                            onChange={(e) => handleChange(index, 'buying_price', e.target.value)}
                            placeholder="0"
                            required
                          />
                        </div>

                        <div className="field-group">
                          <label>Subtotal</label>
                          <div className="price-display subtotal">
                            RWF {((Number(item.buying_price) || 0) * (Number(item.quantity) || 0)).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {product && (
                        <div className="stock-hint">
                          Current stock: {product.current_quantity} {product.unit || 'pcs'} → After: {product.current_quantity + Number(item.quantity || 0)}
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
                  <span className="sale-total-value">RWF {total.toLocaleString()}</span>
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


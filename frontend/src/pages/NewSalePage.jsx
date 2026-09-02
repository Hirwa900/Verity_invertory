import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = 'http://localhost:5000/api';

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export default function NewSalePage() {
  const navigate = useNavigate();
  const [saleDate, setSaleDate] = useState(todayStr());
  const [items, setItems] = useState([{ product_id: '', quantity: 1 }]);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) { setError('Not logged in.'); setLoadingProducts(false); return; }
    axios.get(`${API}/products`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setProducts(r.data.filter((p) => p.is_active)))
      .catch(() => setError('Unable to load products.'))
      .finally(() => setLoadingProducts(false));
  }, []);

  const getProduct = (id) => products.find((p) => p.id === Number(id));

  const handleProductChange = (index, productId) => {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, product_id: productId, quantity: 1 } : item));
  };

  const handleQtyChange = (index, qty) => {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, quantity: Math.max(1, Number(qty)) } : item));
  };

  const addItem = () => setItems((prev) => [...prev, { product_id: '', quantity: 1 }]);
  const removeItem = (index) => setItems((prev) => prev.filter((_, i) => i !== index));

  const total = items.reduce((sum, item) => {
    const p = getProduct(item.product_id);
    return sum + (p ? p.selling_price * item.quantity : 0);
  }, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    const token = localStorage.getItem('authToken');
    try {
      await axios.post(`${API}/sales`, {
        sale_date: saleDate,
        items: items.map((i) => ({ product_id: Number(i.product_id), quantity: Number(i.quantity) })),
      }, { headers: { Authorization: `Bearer ${token}` } });
      setSuccess('Sale recorded successfully!');
      setItems([{ product_id: '', quantity: 1 }]);
      setSaleDate(todayStr());
      // Refresh products to show updated quantities
      const r = await axios.get(`${API}/products`, { headers: { Authorization: `Bearer ${token}` } });
      setProducts(r.data.filter((p) => p.is_active));
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to record sale.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="inner-page">
      <div className="inner-page-card">
        <div className="inner-page-header">
          <button type="button" className="back-btn" onClick={() => navigate('/dashboard')}>← Dashboard</button>
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
                  const product = getProduct(item.product_id);
                  const stockOk = product ? product.current_quantity >= item.quantity : true;
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
                            max={product ? product.current_quantity : undefined}
                            value={item.quantity}
                            onChange={(e) => handleQtyChange(index, e.target.value)}
                            required
                          />
                        </div>

                        <div className="field-group">
                          <label>Sell Price</label>
                          <div className="price-display">
                            {product ? `RWF ${Number(product.selling_price).toLocaleString()}` : '—'}
                          </div>
                        </div>

                        <div className="field-group">
                          <label>Subtotal</label>
                          <div className="price-display subtotal">
                            {product ? `RWF ${(product.selling_price * item.quantity).toLocaleString()}` : '—'}
                          </div>
                        </div>
                      </div>

                      {product && (
                        <div className={`stock-hint ${!stockOk ? 'stock-hint-warn' : ''}`}>
                          {stockOk
                            ? `✓ ${product.current_quantity} in stock`
                            : `⚠ Only ${product.current_quantity} in stock!`}
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
                  <span>Total</span>
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
              {submitting ? 'Saving…' : 'Record Sale'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

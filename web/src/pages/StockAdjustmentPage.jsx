import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listProducts } from '../lib/collections';
import { call, friendlyFunctionMessage } from '../lib/functions';

export default function StockAdjustmentPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ productId: '', quantityChange: '', reason: '' });
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    listProducts()
      .then(setProducts)
      .catch(() => setError('Unable to load products.'))
      .finally(() => setLoadingProducts(false));
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await call('adjustStock', {
        productId: form.productId,
        quantityChange: Number(form.quantityChange),
        reason: form.reason,
      });
      setSuccess('Stock adjustment recorded successfully.');
      setForm({ productId: '', quantityChange: '', reason: '' });
      setProducts(await listProducts());
    } catch (submitError) {
      setError(friendlyFunctionMessage(submitError));
    }
  };

  const selectedProduct = products.find((p) => p.id === form.productId);

  return (
    <div className="page dashboard-page">
      <div className="card auth-card">
        <button type="button" className="secondary-button" onClick={() => navigate('/dashboard')}>← Back to Dashboard</button>
        <h1>Stock Adjustment</h1>
        <form onSubmit={handleSubmit} className="entity-form">
          {loadingProducts ? (
            <p>Loading products...</p>
          ) : products.length === 0 ? (
            <p className="form-error">No products available. Please add products first.</p>
          ) : (
            <>
              <label>Product</label>
              <select name="productId" value={form.productId} onChange={handleChange} required>
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.sku || product.id}) - Stock: {product.quantity}
                  </option>
                ))}
              </select>
              <label>Quantity Change (use a negative number to remove stock)</label>
              <input name="quantityChange" type="number" step="1" value={form.quantityChange} onChange={handleChange} required />
              <label>Reason / Notes</label>
              <textarea name="reason" value={form.reason} onChange={handleChange} placeholder="e.g. Damaged goods, stock count correction" />
              {selectedProduct && <p>Current stock: {selectedProduct.quantity}</p>}
            </>
          )}
          {error && <p className="form-error">{error}</p>}
          {success && <p className="form-success">{success}</p>}
          <button type="submit">Save Adjustment</button>
        </form>
      </div>
    </div>
  );
}

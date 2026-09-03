import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API from '../api';

function StockAdjustmentPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ product_id: '', quantity: '', movement_type: 'adjustment', notes: '' });
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      setError('You must be logged in to load products.');
      setLoadingProducts(false);
      return;
    }

    const fetchProducts = async () => {
      try {
        const response = await axios.get(`${API}/products`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setProducts(response.data);
      } catch (fetchError) {
        setError('Unable to load products. Please make sure you are logged in.');
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchProducts();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const token = localStorage.getItem('authToken');
    if (!token) {
      setError('You must be logged in to adjust stock.');
      return;
    }

    try {
      await axios.post(
        `${API}/stock/adjustment`,
        {
          product_id: Number(form.product_id),
          quantity: Number(form.quantity),
          movement_type: form.movement_type,
          notes: form.notes,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess('Stock adjustment recorded successfully.');
      setForm({ product_id: '', quantity: '', movement_type: 'adjustment', notes: '' });
    } catch (submitError) {
      setError(submitError.response?.data?.message || 'Unable to adjust stock');
    }
  };

  const selectedProduct = products.find((product) => product.id === Number(form.product_id));

  return (
    <div className="page dashboard-page">
      <div className="card auth-card">
        <button type="button" className="secondary-button" onClick={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </button>
        <h1>Stock Adjustment</h1>
        <form onSubmit={handleSubmit} className="entity-form">
          {loadingProducts ? (
            <p>Loading products...</p>
          ) : products.length === 0 ? (
            <p className="form-error">No products available. Please add products first.</p>
          ) : (
            <>
              <label>Product</label>
              <select name="product_id" value={form.product_id} onChange={handleChange} required>
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.sku}) - Stock: {product.current_quantity}
                  </option>
                ))}
              </select>
              <label>Quantity</label>
              <input name="quantity" type="number" value={form.quantity} onChange={handleChange} required />
              <label>Movement Type</label>
              <select name="movement_type" value={form.movement_type} onChange={handleChange} required>
                <option value="adjustment">adjustment</option>
                <option value="correction">correction</option>
                <option value="audit">audit</option>
              </select>
              <label>Notes</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} />
              {selectedProduct && <p>Current stock: {selectedProduct.current_quantity}</p>}
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

export default StockAdjustmentPage;


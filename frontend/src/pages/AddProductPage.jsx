import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = 'http://localhost:5000/api';

export default function AddProductPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [form, setForm] = useState({
    name: '',
    category_id: '',
    sku: '',
    buying_price: '',
    selling_price: '',
    current_quantity: '',
    minimum_quantity: '5',
    unit: 'piece',
  });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    axios.get(`${API}/categories`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setCategories(r.data))
      .catch(() => {})
      .finally(() => setLoadingCats(false));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const numFields = ['buying_price', 'selling_price', 'current_quantity'];
    const invalid = numFields.find((f) => !Number.isFinite(Number(form[f])) || form[f] === '');
    if (invalid) {
      setError('Please enter valid numeric values for prices and quantity.');
      return;
    }

    if (numFields.some((f) => Number(form[f]) < 0)) {
      setError('Prices and quantities cannot be negative.');
      return;
    }

    const token = localStorage.getItem('authToken');
    if (!token) {
      setError('You must be logged in to add a product.');
      return;
    }

    try {
      setIsSubmitting(true);
      await axios.post(
        `${API}/products`,
        {
          name: form.name.trim(),
          category_id: form.category_id ? Number(form.category_id) : null,
          sku: form.sku.trim() || undefined,
          buying_price: Number(form.buying_price),
          selling_price: Number(form.selling_price),
          current_quantity: Number(form.current_quantity),
          minimum_quantity: Number(form.minimum_quantity) || 0,
          unit: form.unit.trim() || 'piece',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      navigate('/products', { state: { successMessage: `Product "${form.name}" created successfully!` } });
    } catch (err) {
      console.error('Create product error:', err);
      const msg = err.response?.data?.message || err.response?.data?.error || 'Unable to create product.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="inner-page">
      <div className="inner-page-card">
        <div className="inner-page-header">
          <button type="button" className="back-btn" onClick={() => navigate('/products')}>
            ← Back to Products
          </button>
          <h1>Add New Product</h1>
          <p className="page-sub">Add a new item to inventory with pricing and category.</p>
        </div>

        <form onSubmit={handleSubmit} className="sale-form">
          <div className="form-row">
            <div className="field-group" style={{ flex: 2 }}>
              <label htmlFor="name">Product Name *</label>
              <input
                id="name"
                name="name"
                placeholder="e.g. Oxford Mathematical Set"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="field-group">
              <label htmlFor="category_id">Category</label>
              <select
                id="category_id"
                name="category_id"
                value={form.category_id}
                onChange={handleChange}
              >
                <option value="">— Select Category —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="field-group">
              <label htmlFor="sku">SKU / Code (Optional)</label>
              <input
                id="sku"
                name="sku"
                placeholder="e.g. STAT-001 (auto-generated if empty)"
                value={form.sku}
                onChange={handleChange}
              />
            </div>

            <div className="field-group">
              <label htmlFor="unit">Unit of Measure</label>
              <input
                id="unit"
                name="unit"
                placeholder="e.g. piece, box, carton, pack"
                value={form.unit}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="field-group">
              <label htmlFor="buying_price">Buying Price (RWF) *</label>
              <input
                id="buying_price"
                name="buying_price"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={form.buying_price}
                onChange={handleChange}
                required
              />
            </div>

            <div className="field-group">
              <label htmlFor="selling_price">Selling Price (RWF) *</label>
              <input
                id="selling_price"
                name="selling_price"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={form.selling_price}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="field-group">
              <label htmlFor="current_quantity">Initial Stock Quantity *</label>
              <input
                id="current_quantity"
                name="current_quantity"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={form.current_quantity}
                onChange={handleChange}
                required
              />
            </div>

            <div className="field-group">
              <label htmlFor="minimum_quantity">Low Stock Alert Threshold</label>
              <input
                id="minimum_quantity"
                name="minimum_quantity"
                type="number"
                min="0"
                step="1"
                placeholder="5"
                value={form.minimum_quantity}
                onChange={handleChange}
              />
            </div>
          </div>

          {error && <div className="form-error-box">{error}</div>}

          <div className="form-actions-row">
            <button type="button" className="btn-secondary" onClick={() => navigate('/products')}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving Product…' : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

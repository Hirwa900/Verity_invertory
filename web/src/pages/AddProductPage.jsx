import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { listCategories } from '../lib/collections';
import { call, friendlyFunctionMessage } from '../lib/functions';
import { bumpDataRevision } from '../lib/queryCache';

export default function AddProductPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    name: '', categoryId: '', sku: '', buyingPrice: '', sellingPrice: '',
    initialQuantity: '', minimumQuantity: '5', unit: 'piece',
  });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    listCategories().then(setCategories).catch(() => {}).finally(() => {});
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const buyingCents = Math.round(Number(form.buyingPrice) * 100);
    const sellingCents = Math.round(Number(form.sellingPrice) * 100);
    const initialQty = Number(form.initialQuantity);
    if (!Number.isFinite(buyingCents) || !Number.isFinite(sellingCents) || !Number.isFinite(initialQty) ||
        buyingCents < 0 || sellingCents < 0 || initialQty < 0) {
      setError('Please enter valid non-negative numbers for prices and quantity.');
      return;
    }

    setIsSubmitting(true);
    try {
      const category = categories.find((c) => c.id === form.categoryId);
      const productRef = await addDoc(collection(db, 'verity_products'), {
        name: form.name.trim(),
        categoryId: form.categoryId || null,
        categoryName: category ? category.name : null,
        sku: form.sku.trim() || null,
        unit: form.unit.trim() || 'piece',
        buyingPriceCents: buyingCents,
        sellingPriceCents: sellingCents,
        quantity: 0,
        minimumQuantity: Number(form.minimumQuantity) || 0,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      bumpDataRevision();
      if (initialQty > 0) {
        await call('adjustStock', {
          productId: productRef.id,
          quantityChange: initialQty,
          reason: 'Initial stock on product creation',
        });
      }
      navigate('/products', { state: { successMessage: `Product "${form.name}" created successfully!` } });
    } catch (err) {
      console.error('Create product error:', err);
      setError(friendlyFunctionMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="inner-page">
      <div className="inner-page-card">
        <div className="inner-page-header">
          <button type="button" className="back-btn" onClick={() => navigate('/products')}>← Back to Products</button>
          <h1>Add New Product</h1>
          <p className="page-sub">Add a new item to inventory with pricing and category.</p>
        </div>

        <form onSubmit={handleSubmit} className="sale-form">
          <div className="form-row">
            <div className="field-group" style={{ flex: 2 }}>
              <label htmlFor="name">Product Name *</label>
              <input id="name" name="name" placeholder="e.g. Oxford Mathematical Set"
                value={form.name} onChange={handleChange} required />
            </div>
            <div className="field-group">
              <label htmlFor="categoryId">Category</label>
              <select id="categoryId" name="categoryId" value={form.categoryId} onChange={handleChange}>
                <option value="">— Select Category —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="field-group">
              <label htmlFor="sku">SKU / Code (Optional)</label>
              <input id="sku" name="sku" placeholder="e.g. STAT-001" value={form.sku} onChange={handleChange} />
            </div>
            <div className="field-group">
              <label htmlFor="unit">Unit of Measure</label>
              <input id="unit" name="unit" placeholder="e.g. piece, box, carton, pack"
                value={form.unit} onChange={handleChange} />
            </div>
          </div>

          <div className="form-row">
            <div className="field-group">
              <label htmlFor="buyingPrice">Buying Price (RWF) *</label>
              <input id="buyingPrice" name="buyingPrice" type="number" min="0" step="0.01" placeholder="0"
                value={form.buyingPrice} onChange={handleChange} required />
            </div>
            <div className="field-group">
              <label htmlFor="sellingPrice">Selling Price (RWF) *</label>
              <input id="sellingPrice" name="sellingPrice" type="number" min="0" step="0.01" placeholder="0"
                value={form.sellingPrice} onChange={handleChange} required />
            </div>
          </div>

          <div className="form-row">
            <div className="field-group">
              <label htmlFor="initialQuantity">Initial Stock Quantity *</label>
              <input id="initialQuantity" name="initialQuantity" type="number" min="0" step="1" placeholder="0"
                value={form.initialQuantity} onChange={handleChange} required />
            </div>
            <div className="field-group">
              <label htmlFor="minimumQuantity">Low Stock Alert Threshold</label>
              <input id="minimumQuantity" name="minimumQuantity" type="number" min="0" step="1" placeholder="5"
                value={form.minimumQuantity} onChange={handleChange} />
            </div>
          </div>

          {error && <div className="form-error-box">{error}</div>}

          <div className="form-actions-row">
            <button type="button" className="btn-secondary" onClick={() => navigate('/products')}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving Product…' : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

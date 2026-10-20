import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { listProducts, listCategories } from '../lib/collections';
import { formatRWF } from '../lib/money';
import { bumpDataRevision } from '../lib/queryCache';

export default function ProductsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProductId, setEditingProductId] = useState(null);
  const [editProduct, setEditProduct] = useState(null);

  const load = () => Promise.all([listProducts(), listCategories()]);

  useEffect(() => {
    if (location.state?.successMessage) setSuccess(location.state.successMessage);
    load()
      .then(([prods, cats]) => { setProducts(prods); setCategories(cats); })
      .catch(() => setError('Unable to load products.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(() => setSuccess(null), 4000);
    return () => clearTimeout(timer);
  }, [success]);

  const startEdit = (product) => {
    setEditingProductId(product.id);
    setEditProduct({
      name: product.name ?? '',
      categoryId: product.categoryId ?? '',
      sku: product.sku ?? '',
      unit: product.unit ?? '',
      buyingPrice: (product.buyingPriceCents / 100).toString(),
      sellingPrice: (product.sellingPriceCents / 100).toString(),
      minimumQuantity: String(product.minimumQuantity ?? 0),
      isActive: product.isActive !== false,
    });
    setError(null);
    setSuccess(null);
  };

  const cancelEdit = () => { setEditingProductId(null); setEditProduct(null); };

  const handleEditChange = (field, value) => setEditProduct((prev) => ({ ...prev, [field]: value }));

  const saveProduct = async (productId) => {
    setError(null);
    try {
      if (!editProduct.name?.trim()) throw new Error('Product name is required.');
      const buyingCents = Math.round(Number(editProduct.buyingPrice) * 100);
      const sellingCents = Math.round(Number(editProduct.sellingPrice) * 100);
      if (!Number.isFinite(buyingCents) || !Number.isFinite(sellingCents) ||
          buyingCents < 0 || sellingCents < 0 ||
          !Number.isFinite(Number(editProduct.minimumQuantity)) || Number(editProduct.minimumQuantity) < 0) {
        throw new Error('Prices and quantities must be valid non-negative numbers.');
      }
      const category = categories.find((c) => c.id === editProduct.categoryId);
      const payload = {
        name: editProduct.name.trim(),
        categoryId: editProduct.categoryId || null,
        categoryName: category ? category.name : null,
        sku: editProduct.sku.trim() || null,
        unit: editProduct.unit.trim() || 'piece',
        buyingPriceCents: buyingCents,
        sellingPriceCents: sellingCents,
        minimumQuantity: Number(editProduct.minimumQuantity),
        isActive: editProduct.isActive,
      };
      await updateDoc(doc(db, 'verity_products', productId), payload);
      bumpDataRevision();
      setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, ...payload } : p)));
      cancelEdit();
      setSuccess('Product updated successfully.');
    } catch (e) {
      setError(e?.message || 'Unable to update product.');
    }
  };

  const deactivateProduct = async (product) => {
    setError(null);
    setSuccess(null);
    try {
      await updateDoc(doc(db, 'verity_products', product.id), { isActive: false });
      bumpDataRevision();
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, isActive: false } : p)));
      setSuccess(`"${product.name}" deactivated. It no longer appears in sales.`);
    } catch (e) {
      setError(e?.message || 'Unable to deactivate product.');
    }
  };

  const isEditing = (productId) => editingProductId === productId && editProduct;

  return (
    <div className="page dashboard-page">
      <div className="card product-card">
        <div className="product-header">
          <div>
            <div className="product-header-actions">
              <button type="button" className="secondary-button" onClick={() => navigate('/dashboard')}>← Back to Dashboard</button>
              {isAdmin && <button type="button" className="secondary-button" onClick={() => navigate('/add-product')}>Add Product</button>}
            </div>
            <h1>All Products</h1>
            <p className="product-subtitle">Browse and manage all inventory items in one place.</p>
          </div>
          <div className="product-summary">
            <div><span>{products.length}</span><p>Total products</p></div>
            <div><span>{loading ? '...' : products.filter((p) => p.isActive !== false).length}</span><p>Active</p></div>
          </div>
        </div>

        {loading ? (
          <p className="page-message">Loading products...</p>
        ) : error ? (
          <p className="form-error">{error}</p>
        ) : (
          <>
            {success && <div className="toast-message">{success}</div>}
            {products.length === 0 ? (
              <p className="page-message">No products found. Add products from the dashboard.</p>
            ) : (
              <div className="table-card products-table-card">
                <div className="card-header">
                  <div><h2>Products</h2><p>{products.length} products loaded</p></div>
                </div>
                <div className="product-search-bar">
                  <input
                    type="search"
                    placeholder="Search products by name, category, SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th><th>Category</th><th>SKU</th><th>Quantity</th><th>Min Qty</th>
                        <th>Unit</th><th>Buy Price</th><th>Sell Price</th><th>Status</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products
                        .filter((product) => {
                          if (!searchTerm) return true;
                          const term = searchTerm.toLowerCase();
                          return (
                            product.name?.toLowerCase().includes(term) ||
                            product.categoryName?.toLowerCase().includes(term) ||
                            product.sku?.toLowerCase().includes(term) ||
                            product.unit?.toLowerCase().includes(term)
                          );
                        })
                        .map((product) => (
                          <tr key={product.id}>
                            <td>
                              {isEditing(product.id) ? (
                                <input className="cell-edit-input" type="text" value={editProduct.name}
                                  onChange={(e) => handleEditChange('name', e.target.value)} />
                              ) : product.name}
                            </td>
                            <td>
                              {isEditing(product.id) ? (
                                <select className="cell-edit-input" value={editProduct.categoryId}
                                  onChange={(e) => handleEditChange('categoryId', e.target.value)}>
                                  <option value="">— No Category —</option>
                                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                              ) : (product.categoryName || '—')}
                            </td>
                            <td>
                              {isEditing(product.id) ? (
                                <input className="cell-edit-input" type="text" value={editProduct.sku}
                                  onChange={(e) => handleEditChange('sku', e.target.value)} />
                              ) : (product.sku || '—')}
                            </td>
                            <td>{product.quantity ?? '—'}</td>
                            <td>
                              {isEditing(product.id) ? (
                                <input className="cell-edit-input" type="number" min="0" step="1" value={editProduct.minimumQuantity}
                                  onChange={(e) => handleEditChange('minimumQuantity', e.target.value)} />
                              ) : (product.minimumQuantity ?? 0)}
                            </td>
                            <td>
                              {isEditing(product.id) ? (
                                <input className="cell-edit-input" type="text" value={editProduct.unit}
                                  onChange={(e) => handleEditChange('unit', e.target.value)} />
                              ) : (product.unit || '—')}
                            </td>
                            <td>
                              {isEditing(product.id) ? (
                                <input className="cell-edit-input" type="number" min="0" step="0.01" value={editProduct.buyingPrice}
                                  onChange={(e) => handleEditChange('buyingPrice', e.target.value)} />
                              ) : formatRWF(product.buyingPriceCents)}
                            </td>
                            <td>
                              {isEditing(product.id) ? (
                                <input className="cell-edit-input" type="number" min="0" step="0.01" value={editProduct.sellingPrice}
                                  onChange={(e) => handleEditChange('sellingPrice', e.target.value)} />
                              ) : formatRWF(product.sellingPriceCents)}
                            </td>
                            <td>
                              {isEditing(product.id) ? (
                                <select className="cell-edit-input" value={String(editProduct.isActive)}
                                  onChange={(e) => handleEditChange('isActive', e.target.value === 'true')}>
                                  <option value="true">Active</option>
                                  <option value="false">Inactive</option>
                                </select>
                              ) : (product.isActive !== false ? 'Active' : 'Inactive')}
                            </td>
                            <td className="product-actions">
                              {isEditing(product.id) ? (
                                <>
                                  <button type="button" className="btn-action btn-action-save" onClick={() => saveProduct(product.id)}>Save</button>
                                  <button type="button" className="btn-action btn-action-cancel" onClick={cancelEdit}>Cancel</button>
                                </>
                              ) : (
                                <>
                                  {isAdmin && (
                                    <button type="button" className="btn-action btn-action-edit" onClick={() => startEdit(product)}>Edit</button>
                                  )}
                                  {isAdmin && product.isActive !== false ? (
                                    <button type="button" className="btn-action btn-action-delete" onClick={() => deactivateProduct(product)}>Deactivate</button>
                                  ) : (
                                    <button type="button" className="btn-action btn-action-cancel" disabled>Inactive</button>
                                  )}
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

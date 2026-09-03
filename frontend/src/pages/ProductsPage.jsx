import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import API from '../api';

function ProductsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProductId, setEditingProductId] = useState(null);
  const [editProduct, setEditProduct] = useState(null);

  const startEdit = (product) => {
    setEditingProductId(product.id);
    setEditProduct({
      name: product.name ?? '',
      category_id: product.category_id ?? '',
      sku: product.sku ?? '',
      unit: product.unit ?? '',
      buying_price: product.buying_price ?? '',
      selling_price: product.selling_price ?? '',
      current_quantity: product.current_quantity ?? '',
      minimum_quantity: product.minimum_quantity ?? '',
      is_active: product.is_active,
    });
    clearMessages();
  };

  const cancelEdit = () => {
    setEditingProductId(null);
    setEditProduct(null);
  };

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const handleEditChange = (field, value) => {
    setEditProduct((prev) => ({ ...prev, [field]: value }));
  };

  const saveProduct = async (productId) => {
    setError(null);
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('You must be logged in to update products.');
      }

      if (!editProduct.name?.trim()) {
        throw new Error('Product name is required.');
      }

      const numFields = ['buying_price', 'selling_price', 'current_quantity', 'minimum_quantity'];
      for (const f of numFields) {
        if (!Number.isFinite(Number(editProduct[f])) || Number(editProduct[f]) < 0) {
          throw new Error('Prices and quantities must be valid non-negative numbers.');
        }
      }

      const body = {
        name: editProduct.name.trim(),
        category_id: editProduct.category_id ? Number(editProduct.category_id) : null,
        sku: editProduct.sku.trim() || null,
        unit: editProduct.unit.trim() || 'piece',
        buying_price: Number(editProduct.buying_price),
        selling_price: Number(editProduct.selling_price),
        current_quantity: Number(editProduct.current_quantity),
        minimum_quantity: Number(editProduct.minimum_quantity),
        is_active: editProduct.is_active,
      };

      await axios.put(`${API}/products/${productId}`, body, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setProducts((prevProducts) =>
        prevProducts.map((product) => {
          if (product.id !== productId) return product;
          const category = categories.find((c) => c.id === Number(body.category_id));
          return {
            ...product,
            name: body.name,
            category_id: body.category_id,
            category_name: category ? category.name : null,
            sku: body.sku,
            unit: body.unit,
            buying_price: body.buying_price,
            selling_price: body.selling_price,
            current_quantity: body.current_quantity,
            minimum_quantity: body.minimum_quantity,
            is_active: body.is_active,
          };
        })
      );
      cancelEdit();
      setSuccess('Product updated successfully.');
    } catch (updateError) {
      console.error('Update product error:', updateError);
      setError(updateError.response?.data?.message || updateError.message || 'Unable to update product.');
    }
  };

  const deleteProduct = async (productId) => {
    if (!window.confirm('Delete this product? This cannot be undone.')) {
      return;
    }
    setError(null);
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('You must be logged in to delete products.');
      }

      await axios.delete(`${API}/products/${productId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setProducts((prevProducts) => prevProducts.filter((product) => product.id !== productId));
      if (editingProductId === productId) {
        cancelEdit();
      }
      setSuccess('Product deleted successfully.');
    } catch (deleteError) {
      console.error('Delete product error:', deleteError);
      setError(deleteError.response?.data?.message || deleteError.message || 'Unable to delete product.');
    }
  };

  useEffect(() => {
    if (location.state?.successMessage) {
      setSuccess(location.state.successMessage);
    }

    const token = localStorage.getItem('authToken');
    if (!token) {
      setError('You must be logged in to view products. Please login first.');
      setLoading(false);
      return;
    }

    const fetchCategories = axios.get(`${API}/categories`, { headers: { Authorization: `Bearer ${token}` } });
    const fetchProducts = axios.get(`${API}/products`, { headers: { Authorization: `Bearer ${token}` } });

    Promise.all([fetchCategories, fetchProducts])
      .then(([catRes, prodRes]) => {
        setCategories(Array.isArray(catRes.data) ? catRes.data : []);
        if (!Array.isArray(prodRes.data)) {
          console.error('Expected products array but got:', prodRes.data);
          setError('Unexpected products response from server.');
          setProducts([]);
          return;
        }
        setProducts(prodRes.data);
      })
      .catch((fetchError) => {
        console.error('Fetch products error:', fetchError);
        const status = fetchError.response?.status;
        if (status === 401 || status === 403) {
          setError('Authentication error. Please login again.');
        } else {
          setError(fetchError.response?.data?.message || 'Unable to load products.');
        }
      })
      .finally(() => setLoading(false));

    return () => {
      clearMessages();
    };
  }, []);

  useEffect(() => {
    if (!success) return undefined;

    const timer = setTimeout(() => {
      setSuccess(null);
    }, 4000);

    return () => clearTimeout(timer);
  }, [success]);

  const formatPrice = (value) => {
    if (value === undefined || value === null || value === '') {
      return '—';
    }

    const amount = Number(value);
    return Number.isNaN(amount) ? '—' : amount.toFixed(2);
  };

  const isEditing = (productId) => editingProductId === productId && editProduct;

  return (
    <div className="page dashboard-page">
      <div className="card product-card">
        <div className="product-header">
          <div>
            <div className="product-header-actions">
              <button type="button" className="secondary-button" onClick={() => navigate('/dashboard')}>
                ← Back to Dashboard
              </button>
              <button type="button" className="secondary-button" onClick={() => navigate('/add-product')}>
                Add Product
              </button>
            </div>
            <h1>All Products</h1>
            <p className="product-subtitle">Browse and manage all inventory items in one place.</p>
          </div>
          <div className="product-summary">
            <div>
              <span>{products.length}</span>
              <p>Total products</p>
            </div>
            <div>
              <span>{loading ? '...' : products.filter((product) => product.is_active).length}</span>
              <p>Active</p>
            </div>
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
                  <div>
                    <h2>Products</h2>
                    <p>{products.length} products loaded</p>
                  </div>
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
                        <th>Name</th>
                        <th>Category</th>
                        <th>SKU</th>
                        <th>Quantity</th>
                        <th>Min Qty</th>
                        <th>Unit</th>
                        <th>Buy Price</th>
                        <th>Sell Price</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products
                        .filter((product) => {
                          if (!searchTerm) return true;
                          const term = searchTerm.toLowerCase();
                          return (
                            product.name?.toLowerCase().includes(term) ||
                            product.category_name?.toLowerCase().includes(term) ||
                            product.sku?.toLowerCase().includes(term) ||
                            product.unit?.toLowerCase().includes(term)
                          );
                        })
                        .map((product) => (
                          <tr key={product.id}>
                            <td>
                              {isEditing(product.id) ? (
                                <input
                                  className="cell-edit-input"
                                  type="text"
                                  value={editProduct.name}
                                  onChange={(e) => handleEditChange('name', e.target.value)}
                                />
                              ) : (
                                product.name
                              )}
                            </td>
                            <td>
                              {isEditing(product.id) ? (
                                <select
                                  className="cell-edit-input"
                                  value={editProduct.category_id}
                                  onChange={(e) => handleEditChange('category_id', e.target.value)}
                                >
                                  <option value="">— No Category —</option>
                                  {categories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <>
                                  {product.category_name ? (
                                    <button
                                      type="button"
                                      className="category-link"
                                      onClick={() => {
                                        try {
                                          localStorage.setItem('lastSelectedCategoryId', product.category_id?.toString() || '');
                                        } catch (e) {}
                                        navigate('/add-product', { state: { selectedCategoryId: product.category_id } });
                                      }}
                                    >
                                      {product.category_name}
                                    </button>
                                  ) : (
                                    '—'
                                  )}
                                </>
                              )}
                            </td>
                            <td>
                              {isEditing(product.id) ? (
                                <input
                                  className="cell-edit-input"
                                  type="text"
                                  value={editProduct.sku}
                                  onChange={(e) => handleEditChange('sku', e.target.value)}
                                />
                              ) : (
                                product.sku || '—'
                              )}
                            </td>
                            <td>
                              {isEditing(product.id) ? (
                                <input
                                  className="cell-edit-input"
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={editProduct.current_quantity}
                                  onChange={(e) => handleEditChange('current_quantity', e.target.value)}
                                />
                              ) : (
                                product.current_quantity ?? '—'
                              )}
                            </td>
                            <td>
                              {isEditing(product.id) ? (
                                <input
                                  className="cell-edit-input"
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={editProduct.minimum_quantity}
                                  onChange={(e) => handleEditChange('minimum_quantity', e.target.value)}
                                />
                              ) : (
                                product.minimum_quantity ?? '—'
                              )}
                            </td>
                            <td>
                              {isEditing(product.id) ? (
                                <input
                                  className="cell-edit-input"
                                  type="text"
                                  value={editProduct.unit}
                                  onChange={(e) => handleEditChange('unit', e.target.value)}
                                />
                              ) : (
                                product.unit || '—'
                              )}
                            </td>
                            <td>
                              {isEditing(product.id) ? (
                                <input
                                  className="cell-edit-input"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editProduct.buying_price}
                                  onChange={(e) => handleEditChange('buying_price', e.target.value)}
                                />
                              ) : (
                                formatPrice(product.buying_price)
                              )}
                            </td>
                            <td>
                              {isEditing(product.id) ? (
                                <input
                                  className="cell-edit-input"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editProduct.selling_price}
                                  onChange={(e) => handleEditChange('selling_price', e.target.value)}
                                />
                              ) : (
                                formatPrice(product.selling_price)
                              )}
                            </td>
                            <td>
                              {isEditing(product.id) ? (
                                <select
                                  className="cell-edit-input"
                                  value={editProduct.is_active ? 'true' : 'false'}
                                  onChange={(e) => handleEditChange('is_active', e.target.value === 'true')}
                                >
                                  <option value="true">Active</option>
                                  <option value="false">Inactive</option>
                                </select>
                              ) : (
                                product.is_active ? 'Active' : 'Inactive'
                              )}
                            </td>
                            <td className="product-actions">
                              {isEditing(product.id) ? (
                                <>
                                  <button type="button" className="btn-action btn-action-save" onClick={() => saveProduct(product.id)}>
                                    Save
                                  </button>
                                  <button type="button" className="btn-action btn-action-cancel" onClick={cancelEdit}>
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button type="button" className="btn-action btn-action-edit" onClick={() => startEdit(product)}>
                                    Edit
                                  </button>
                                  <button type="button" className="btn-action btn-action-delete" onClick={() => deleteProduct(product.id)}>
                                    Delete
                                  </button>
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

export default ProductsPage;

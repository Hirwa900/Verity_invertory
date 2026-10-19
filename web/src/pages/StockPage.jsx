import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listProducts, listStockMovements } from '../lib/collections';
import { formatRWF } from '../lib/money';

function stockStatus(current, min) {
  if (current === 0) return { label: 'Out of Stock', cls: 'badge-red' };
  if (current <= (min || 0)) return { label: 'Low Stock', cls: 'badge-yellow' };
  return { label: 'In Stock', cls: 'badge-green' };
}

export default function StockPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isSeller = user?.role === 'seller';
  const isAdmin = user?.role === 'admin';
  const [stock, setStock] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const productsPromise = listProducts();
    const movementsPromise = isAdmin ? listStockMovements({ max: 25 }) : Promise.resolve([]);
    Promise.all([productsPromise, movementsPromise])
      .then(([prods, movs]) => { setStock(prods.filter((p) => p.isActive !== false)); setMovements(movs); })
      .catch((e) => setError(e?.message || 'Failed to load stock'))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  const filtered = stock.filter((p) => {
    const term = search.toLowerCase();
    const matchSearch = !search ||
      p.name?.toLowerCase().includes(term) ||
      p.categoryName?.toLowerCase().includes(term) ||
      p.sku?.toLowerCase().includes(term);
    const matchFilter =
      filter === 'all' ? true :
      filter === 'out' ? p.quantity === 0 :
      filter === 'low' ? (p.quantity > 0 && p.quantity <= (p.minimumQuantity || 0)) : true;
    return matchSearch && matchFilter;
  });

  const outCount = stock.filter((p) => p.quantity === 0).length;
  const lowCount = stock.filter((p) => p.quantity > 0 && p.quantity <= (p.minimumQuantity || 0)).length;

  return (
    <div className="inner-page">
      <div className="inner-page-card wide-card">
        <div className="inner-page-header">
          <div className="seller-page-actions">
            <button type="button" className="back-btn" onClick={() => navigate(isSeller ? '/new-sale' : '/dashboard')}>
              {isSeller ? '← New Sale' : '← Dashboard'}
            </button>
            {isSeller && <button type="button" className="seller-logout-btn" onClick={() => { logout(); navigate('/login'); }}>Logout</button>}
          </div>
          <div className="header-row-actions">
            <h1>Stock Overview</h1>
            {isAdmin && <button type="button" className="btn-primary" onClick={() => navigate('/new-purchase')}>+ Restock</button>}
          </div>
          <p className="page-sub">Current inventory levels. Products highlighted in red or yellow need attention.</p>
        </div>

        <div className="stock-summary-pills">
          <button type="button" className={`filter-pill ${filter === 'all' ? 'filter-pill-active' : ''}`} onClick={() => setFilter('all')}>
            All ({stock.length})
          </button>
          <button type="button" className={`filter-pill filter-pill-yellow ${filter === 'low' ? 'filter-pill-active' : ''}`} onClick={() => setFilter('low')}>
            Low Stock ({lowCount})
          </button>
          <button type="button" className={`filter-pill filter-pill-red ${filter === 'out' ? 'filter-pill-active' : ''}`} onClick={() => setFilter('out')}>
            Out of Stock ({outCount})
          </button>
        </div>

        <div className="search-bar-row">
          <input
            type="search"
            placeholder="Search by product name, category, SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
          <span className="record-count">{filtered.length} product{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {loading && <div className="db-loading">Loading stock…</div>}
        {error && <div className="form-error-box">{error}</div>}

        {!loading && !error && (
          filtered.length === 0 ? (
            <p className="empty-msg">No products match your filter.</p>
          ) : (
            <div className="history-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th><th>Category</th><th>SKU</th><th>Qty</th><th>Min Qty</th>
                    <th>Unit</th><th>Sell Price</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const status = stockStatus(p.quantity, p.minimumQuantity);
                    return (
                      <tr key={p.id} className={p.quantity === 0 ? 'row-danger' : p.quantity <= (p.minimumQuantity || 0) ? 'row-warning' : ''}>
                        <td className="product-name-cell">{p.name}</td>
                        <td>{p.categoryName || '—'}</td>
                        <td>{p.sku || '—'}</td>
                        <td><strong>{p.quantity}</strong></td>
                        <td>{p.minimumQuantity || 0}</td>
                        <td>{p.unit || 'pcs'}</td>
                        <td>RWF {formatRWF(p.sellingPriceCents, { decimals: 0 })}</td>
                        <td><span className={`status-badge ${status.cls}`}>{status.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {isAdmin && !loading && !error && (
          <div className="db-card" style={{ marginTop: '2rem' }}>
            <div className="db-card-header"><h2>Recent Stock Movements</h2></div>
            {movements.length === 0 ? (
              <p className="empty-msg">No stock movements yet.</p>
            ) : (
              <table className="mini-table">
                <thead><tr><th>Product</th><th>Type</th><th>Qty</th><th>By</th><th>Note</th></tr></thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td>{m.productName}</td>
                      <td>{m.type}</td>
                      <td>{m.quantity}</td>
                      <td>{m.userName}</td>
                      <td>{m.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

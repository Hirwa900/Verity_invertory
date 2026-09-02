import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = 'http://localhost:5000/api';

function fmt(v) { return Number(v || 0).toLocaleString(); }

function stockStatus(current, min) {
  if (current === 0) return { label: 'Out of Stock', cls: 'badge-red' };
  if (current <= min) return { label: 'Low Stock', cls: 'badge-yellow' };
  return { label: 'In Stock', cls: 'badge-green' };
}

export default function StockPage() {
  const navigate = useNavigate();
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | low | out

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    axios.get(`${API}/stock`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setStock(r.data))
      .catch((e) => setError(e.response?.data?.message || 'Failed to load stock'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = stock.filter((p) => {
    const term = search.toLowerCase();
    const matchSearch = !search ||
      p.name?.toLowerCase().includes(term) ||
      p.category_name?.toLowerCase().includes(term) ||
      p.sku?.toLowerCase().includes(term);
    const matchFilter =
      filter === 'all' ? true :
      filter === 'out' ? p.current_quantity === 0 :
      filter === 'low' ? (p.current_quantity > 0 && p.current_quantity <= p.minimum_quantity) : true;
    return matchSearch && matchFilter;
  });

  const outCount = stock.filter((p) => p.current_quantity === 0).length;
  const lowCount = stock.filter((p) => p.current_quantity > 0 && p.current_quantity <= p.minimum_quantity).length;

  return (
    <div className="inner-page">
      <div className="inner-page-card wide-card">
        <div className="inner-page-header">
          <button type="button" className="back-btn" onClick={() => navigate('/dashboard')}>← Dashboard</button>
          <div className="header-row-actions">
            <h1>Stock Overview</h1>
            <button type="button" className="btn-primary" onClick={() => navigate('/new-purchase')}>+ Restock</button>
          </div>
          <p className="page-sub">Current inventory levels. Products highlighted in red or yellow need attention.</p>
        </div>

        {/* Summary pills */}
        <div className="stock-summary-pills">
          <button
            type="button"
            className={`filter-pill ${filter === 'all' ? 'filter-pill-active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({stock.length})
          </button>
          <button
            type="button"
            className={`filter-pill filter-pill-yellow ${filter === 'low' ? 'filter-pill-active' : ''}`}
            onClick={() => setFilter('low')}
          >
            Low Stock ({lowCount})
          </button>
          <button
            type="button"
            className={`filter-pill filter-pill-red ${filter === 'out' ? 'filter-pill-active' : ''}`}
            onClick={() => setFilter('out')}
          >
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
                    <th>Product</th>
                    <th>Category</th>
                    <th>SKU</th>
                    <th>Qty</th>
                    <th>Min Qty</th>
                    <th>Unit</th>
                    <th>Sell Price</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const status = stockStatus(p.current_quantity, p.minimum_quantity);
                    return (
                      <tr key={p.id} className={p.current_quantity === 0 ? 'row-danger' : p.current_quantity <= p.minimum_quantity ? 'row-warning' : ''}>
                        <td className="product-name-cell">{p.name}</td>
                        <td>{p.category_name || '—'}</td>
                        <td>{p.sku || '—'}</td>
                        <td><strong>{p.current_quantity}</strong></td>
                        <td>{p.minimum_quantity}</td>
                        <td>{p.unit || 'pcs'}</td>
                        <td>RWF {fmt(p.selling_price)}</td>
                        <td><span className={`status-badge ${status.cls}`}>{status.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}

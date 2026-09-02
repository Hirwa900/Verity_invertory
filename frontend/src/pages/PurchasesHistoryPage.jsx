import { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = 'https://verity-inventory-backend.onrender.com/api';

function fmtDate(d) {
  if (!d) return 'â€”';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmt(v) { return Number(v || 0).toLocaleString(); }

export default function PurchasesHistoryPage() {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [details, setDetails] = useState({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    axios.get(`${API}/purchases`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setPurchases(r.data))
      .catch((e) => setError(e.response?.data?.message || 'Failed to load purchases'))
      .finally(() => setLoading(false));
  }, []);

  const toggleExpand = async (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (details[id]) return;
    const token = localStorage.getItem('authToken');
    try {
      const r = await axios.get(`${API}/purchases/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      setDetails((prev) => ({ ...prev, [id]: r.data }));
    } catch { /* ignore */ }
  };

  const filtered = purchases.filter((p) =>
    !search || p.user_name?.toLowerCase().includes(search.toLowerCase()) ||
    fmtDate(p.purchase_date).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="inner-page">
      <div className="inner-page-card wide-card">
        <div className="inner-page-header">
          <button type="button" className="back-btn" onClick={() => navigate('/dashboard')}>â† Dashboard</button>
          <div className="header-row-actions">
            <h1>Purchase History</h1>
            <button type="button" className="btn-primary" onClick={() => navigate('/new-purchase')}>+ New Purchase</button>
          </div>
          <p className="page-sub">All stock restocking records. Click a row to see items.</p>
        </div>

        <div className="search-bar-row">
          <input
            type="search"
            placeholder="Search by date or staff nameâ€¦"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
          <span className="record-count">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {loading && <div className="db-loading">Loadingâ€¦</div>}
        {error && <div className="form-error-box">{error}</div>}

        {!loading && !error && (
          filtered.length === 0 ? (
            <p className="empty-msg">No purchases found.</p>
          ) : (
            <div className="history-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Added By</th>
                    <th>Total Cost</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <Fragment key={p.id}>
                      <tr className={expandedId === p.id ? 'row-expanded' : ''}>
                        <td>{p.id}</td>
                        <td>{fmtDate(p.purchase_date)}</td>
                        <td>{p.user_name}</td>
                        <td className="amount-cell">RWF {fmt(p.total_amount)}</td>
                        <td>
                          <button type="button" className="expand-btn" onClick={() => toggleExpand(p.id)}>
                            {expandedId === p.id ? 'â–² Hide' : 'â–¼ View Items'}
                          </button>
                        </td>
                      </tr>
                      {expandedId === p.id && (
                        <tr className="detail-row">
                          <td colSpan="5">
                            {details[p.id] ? (
                              <table className="detail-table">
                                <thead>
                                  <tr><th>Product</th><th>Qty</th><th>Unit Cost</th><th>Subtotal</th></tr>
                                </thead>
                                <tbody>
                                  {details[p.id].items.map((item) => (
                                    <tr key={item.id}>
                                      <td>{item.product_name}</td>
                                      <td>{item.quantity}</td>
                                      <td>RWF {fmt(item.buying_price)}</td>
                                      <td>RWF {fmt(item.subtotal)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p style={{ margin: '0.75rem 1rem', color: '#6b7280' }}>Loadingâ€¦</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}


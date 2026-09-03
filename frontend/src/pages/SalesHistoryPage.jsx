import { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = '/api';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmt(v) { return Number(v || 0).toLocaleString(); }

export default function SalesHistoryPage() {
  const navigate = useNavigate();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [saleDetails, setSaleDetails] = useState({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    axios.get(`${API}/sales`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setSales(r.data))
      .catch((e) => setError(e.response?.data?.message || 'Failed to load sales'))
      .finally(() => setLoading(false));
  }, []);

  const toggleExpand = async (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (saleDetails[id]) return;
    const token = localStorage.getItem('authToken');
    try {
      const r = await axios.get(`${API}/sales/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      setSaleDetails((prev) => ({ ...prev, [id]: r.data }));
    } catch { /* ignore */ }
  };

  const filtered = sales.filter((s) =>
    !search || s.user_name?.toLowerCase().includes(search.toLowerCase()) ||
    fmtDate(s.sale_date).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="inner-page">
      <div className="inner-page-card wide-card">
        <div className="inner-page-header">
          <button type="button" className="back-btn" onClick={() => navigate('/dashboard')}>← Dashboard</button>
          <div className="header-row-actions">
            <h1>Sales History</h1>
            <button type="button" className="btn-primary" onClick={() => navigate('/new-sale')}>+ New Sale</button>
          </div>
          <p className="page-sub">All recorded sales. Click a row to see items.</p>
        </div>

        <div className="search-bar-row">
          <input
            type="search"
            placeholder="Search by date or staff name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
          <span className="record-count">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {loading && <div className="db-loading">Loading…</div>}
        {error && <div className="form-error-box">{error}</div>}

        {!loading && !error && (
          filtered.length === 0 ? (
            <p className="empty-msg">No sales found.</p>
          ) : (
            <div className="history-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Sold By</th>
                    <th>Total Amount</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, idx) => (
                    <Fragment key={s.id}>
                      <tr className={expandedId === s.id ? 'row-expanded' : ''}>
                        <td>{idx + 1}</td>
                        <td>{fmtDate(s.sale_date)}</td>
                        <td>{s.user_name}</td>
                        <td className="amount-cell">RWF {fmt(s.total_amount)}</td>
                        <td>
                          <button type="button" className="expand-btn" onClick={() => toggleExpand(s.id)}>
                            {expandedId === s.id ? '▲ Hide' : '▼ View Items'}
                          </button>
                        </td>
                      </tr>
                      {expandedId === s.id && (
                        <tr key={`${s.id}-detail`} className="detail-row">
                          <td colSpan="5">
                            {saleDetails[s.id] ? (
                              <table className="detail-table">
                                <thead>
                                  <tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Subtotal</th></tr>
                                </thead>
                                <tbody>
                                  {saleDetails[s.id].items.map((item) => (
                                    <tr key={item.id}>
                                      <td>{item.product_name}</td>
                                      <td>{item.quantity}</td>
                                      <td>RWF {fmt(item.selling_price)}</td>
                                      <td>RWF {fmt(item.subtotal)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p style={{ margin: '0.75rem 1rem', color: '#6b7280' }}>Loading…</p>
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


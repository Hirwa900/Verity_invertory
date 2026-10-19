import { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { listPurchases } from '../lib/collections';
import { formatRWF } from '../lib/money';

export default function PurchasesHistoryPage() {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    listPurchases()
      .then(setPurchases)
      .catch((e) => setError(e?.message || 'Failed to load purchases'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = purchases.filter((p) =>
    !search || p.userName?.toLowerCase().includes(search.toLowerCase()) ||
    String(p.businessDate).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="inner-page">
      <div className="inner-page-card wide-card">
        <div className="inner-page-header">
          <button type="button" className="back-btn" onClick={() => navigate('/dashboard')}>← Dashboard</button>
          <div className="header-row-actions">
            <h1>Purchase History</h1>
            <button type="button" className="btn-primary" onClick={() => navigate('/new-purchase')}>+ New Purchase</button>
          </div>
          <p className="page-sub">All stock restocking records. Click a row to see items.</p>
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
            <p className="empty-msg">No purchases found.</p>
          ) : (
            <div className="history-table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>#</th><th>Date</th><th>Added By</th><th>Total Cost</th><th>Details</th></tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <Fragment key={p.id}>
                      <tr className={expandedId === p.id ? 'row-expanded' : ''}>
                        <td>{p.id}</td>
                        <td>{p.businessDate}</td>
                        <td>{p.userName}</td>
                        <td className="amount-cell">RWF {formatRWF(p.totalCents, { decimals: 0 })}</td>
                        <td>
                          <button type="button" className="expand-btn" onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                            {expandedId === p.id ? '▲ Hide' : '▼ View Items'}
                          </button>
                        </td>
                      </tr>
                      {expandedId === p.id && (
                        <tr className="detail-row">
                          <td colSpan="5">
                            <table className="detail-table">
                              <thead>
                                <tr><th>Product</th><th>Qty</th><th>Unit Cost</th><th>Subtotal</th></tr>
                              </thead>
                              <tbody>
                                {(p.items || []).map((item) => (
                                  <tr key={item.productId}>
                                    <td>{item.productName}</td>
                                    <td>{item.quantity}</td>
                                    <td>RWF {formatRWF(item.unitCostCents, { decimals: 0 })}</td>
                                    <td>RWF {formatRWF(item.subtotalCents, { decimals: 0 })}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
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

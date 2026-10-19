import { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listSales } from '../lib/collections';
import { call, friendlyFunctionMessage } from '../lib/functions';
import { formatRWF } from '../lib/money';

function fmtDate(d) {
  if (!d) return '—';
  return String(d);
}

export default function SalesHistoryPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isSeller = user?.role === 'seller';
  const isAdmin = user?.role === 'admin';
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState('');

  const load = () => listSales({ userId: isSeller ? user.uid : null, activeOnly: true });

  useEffect(() => {
    load()
      .then(setSales)
      .catch((e) => setError(e?.message || 'Failed to load sales'))
      .finally(() => setLoading(false));
  }, []);

  const archiveSale = async (sale) => {
    setError(null);
    setSuccess(null);
    setBusyId(sale.id);
    try {
      await call('archiveSale', { saleId: sale.id });
      setSales((prev) => prev.filter((s) => s.id !== sale.id));
      if (expandedId === sale.id) setExpandedId(null);
      setConfirmingId(null);
      setSuccess('Sale archived. Stock has been restored and reports are updated.');
    } catch (e) {
      setError(friendlyFunctionMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const filtered = sales.filter((s) =>
    !search || s.userName?.toLowerCase().includes(search.toLowerCase()) ||
    fmtDate(s.businessDate).toLowerCase().includes(search.toLowerCase()));

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
            <h1>Sales History</h1>
            <button type="button" className="btn-primary" onClick={() => navigate('/new-sale')}>+ New Sale</button>
          </div>
          <p className="page-sub">{isSeller ? 'Your recorded sales.' : 'All recorded sales.'} Click a row to see items.</p>
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
        {error && <div className="form-error-box" role="alert">{error}</div>}
        {success && <div className="toast-message" role="status">{success}</div>}

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
                        <td>{fmtDate(s.businessDate)}</td>
                        <td>{s.userName}</td>
                        <td className="amount-cell">RWF {formatRWF(s.totalCents, { decimals: 0 })}</td>
                        <td>
                          <button type="button" className="expand-btn" onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                            {expandedId === s.id ? '▲ Hide' : '▼ View Items'}
                          </button>
                          {isAdmin && (
                            confirmingId === s.id ? (
                              <span className="delete-confirm">
                                <span className="delete-confirm-text">Archive #{s.id} &amp; restore stock?</span>
                                <button
                                  type="button"
                                  className="btn-action btn-action-delete"
                                  disabled={busyId === s.id}
                                  onClick={() => archiveSale(s)}
                                >
                                  {busyId === s.id ? 'Archiving…' : 'Yes, archive'}
                                </button>
                                <button
                                  type="button"
                                  className="btn-action btn-action-cancel"
                                  disabled={busyId === s.id}
                                  onClick={() => setConfirmingId(null)}
                                >
                                  Cancel
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="btn-action btn-action-delete"
                                disabled={busyId === s.id}
                                onClick={() => { setError(null); setSuccess(null); setConfirmingId(s.id); }}
                              >
                                Archive
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                      {expandedId === s.id && (
                        <tr className="detail-row">
                          <td colSpan="5">
                            <table className="detail-table">
                              <thead>
                                <tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Subtotal</th></tr>
                              </thead>
                              <tbody>
                                {(s.items || []).map((item) => (
                                  <tr key={item.productId}>
                                    <td>{item.productName}</td>
                                    <td>{item.quantity}</td>
                                    <td>RWF {formatRWF(item.unitPriceCents, { decimals: 0 })}</td>
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

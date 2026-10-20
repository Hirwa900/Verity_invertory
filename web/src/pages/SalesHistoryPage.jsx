import { useState, useEffect, useRef, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listSalesPage } from '../lib/collections';
import { call, friendlyFunctionMessage } from '../lib/functions';
import { formatRWF } from '../lib/money';

const PAGE_SIZE = 50;

function fmtDate(d) {
  if (!d) return '—';
  return String(d);
}

// UI gate for destructive sale actions. The backend re-checks the admin role
// on every deleteSale call, so hiding the button is never the security boundary.
export function canDeleteSales(user) {
  return user?.role === 'admin';
}

export default function SalesHistoryPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isSeller = user?.role === 'seller';
  const isAdmin = canDeleteSales(user);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [deletingSale, setDeletingSale] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState('');

  const queryOptions = { userId: isSeller ? user.uid : null, activeOnly: true };

  const load = () => listSalesPage(queryOptions, { pageSize: PAGE_SIZE });

  const applyFirstPage = (page) => {
    setSales(page.sales);
    cursorRef.current = page.cursor;
    setHasMore(page.hasMore);
  };

  useEffect(() => {
    load()
      .then(applyFirstPage)
      .catch((e) => setError(e?.message || 'Failed to load sales'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = async () => {
    if (!cursorRef.current || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await listSalesPage(queryOptions, { pageSize: PAGE_SIZE, cursor: cursorRef.current });
      setSales((prev) => [...prev, ...page.sales]);
      cursorRef.current = page.cursor;
      setHasMore(page.hasMore);
    } catch (e) {
      setError(e?.message || 'Failed to load more sales');
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!deletingSale) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setDeletingSale(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deletingSale]);

  const openDeleteDialog = (sale) => {
    setError(null);
    setSuccess(null);
    setDeletingSale(sale);
  };

  const deleteSale = async (sale) => {
    setError(null);
    setSuccess(null);
    setBusyId(sale.id);
    try {
      await call('deleteSale', { saleId: sale.id });
      setDeletingSale(null);
      if (expandedId === sale.id) setExpandedId(null);
      applyFirstPage(await load());
      setSuccess('Sale deleted and reversed. Stock was restored, and reports, dashboard, and stock views now exclude it.');
    } catch (e) {
      // Also covers a sale already reversed by someone else: refresh so the
      // list reflects the committed state instead of offering a stale row.
      setDeletingSale(null);
      setError(friendlyFunctionMessage(e));
      load().then(applyFirstPage).catch(() => {});
      if (expandedId === sale.id) setExpandedId(null);
    } finally {
      setBusyId(null);
    }
  };

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
          <span className="record-count">
            {hasMore
              ? `${filtered.length}+ record${filtered.length !== 1 ? 's' : ''}`
              : `${filtered.length} record${filtered.length !== 1 ? 's' : ''}`}
          </span>
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
                          <span className="detail-actions">
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
                            {canDeleteSales(user) && (
                              <button
                                type="button"
                                className="btn-action btn-action-delete"
                                disabled={busyId === s.id}
                                onClick={() => openDeleteDialog(s)}
                              >
                                Delete
                              </button>
                            )}
                          </span>
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

        {!loading && !error && hasMore && (
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <button type="button" className="btn-secondary" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading more sales…' : `Load more sales (loaded ${sales.length})`}
            </button>
          </div>
        )}
      </div>

      {deletingSale && (
        <div className="modal-overlay" onClick={() => setDeletingSale(null)}>
          <div
            className="modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-sale-heading"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-sale-heading">Delete this sale?</h2>
            <p className="modal-body-text">
              Sale <strong>#{deletingSale.id}</strong> will be reversed: its quantities are returned
              to stock and it is excluded from the dashboard and from daily, weekly, monthly, and
              yearly reports. The sale record is kept for audit purposes.
            </p>
            <div className="modal-sale-summary">
              <span>{fmtDate(deletingSale.businessDate)}</span>
              <span>{deletingSale.userName}</span>
              <span>RWF {formatRWF(deletingSale.totalCents, { decimals: 0 })}</span>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-action btn-action-cancel"
                disabled={busyId === deletingSale.id}
                onClick={() => setDeletingSale(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-action btn-action-delete"
                disabled={busyId === deletingSale.id}
                onClick={() => deleteSale(deletingSale)}
              >
                {busyId === deletingSale.id ? 'Deleting…' : 'Yes, delete sale'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

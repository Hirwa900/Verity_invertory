import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { listProducts } from '../lib/collections';
import { formatMoney } from '../lib/money';
import getBusinessDate, { monthStart } from '../lib/businessDate';

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const value = typeof dateStr === 'object' && dateStr.toDate ? dateStr.toDate() : dateStr;
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function movementBadge(type) {
  const map = {
    PURCHASE: { label: 'Purchase', cls: 'badge-green' },
    SALE: { label: 'Sale', cls: 'badge-blue' },
    RETURN: { label: 'Return', cls: 'badge-yellow' },
    DAMAGE: { label: 'Damage', cls: 'badge-red' },
    ADJUSTMENT: { label: 'Adjustment', cls: 'badge-gray' },
  };
  const m = map[type] || { label: type, cls: 'badge-gray' };
  return <span className={`status-badge ${m.cls}`}>{m.label}</span>;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const today = getBusinessDate();
      const [products, salesSnap, purchasesSnap, movementsSnap, monthSalesSnap] = await Promise.all([
        listProducts(),
        getDocs(query(collection(db, 'verity_sales'),
          where('isActive', '==', true), where('businessDate', '==', today), orderBy('businessDate', 'desc'))),
        getDocs(query(collection(db, 'verity_purchases'), orderBy('businessDate', 'desc'), limit(5))),
        getDocs(query(collection(db, 'verity_stockMovements'), orderBy('createdAt', 'desc'), limit(8))),
        getDocs(query(collection(db, 'verity_sales'),
          where('isActive', '==', true), where('businessDate', '>=', monthStart()))),
      ]);

      const sales = salesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const purchases = purchasesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const movements = movementsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const monthSales = monthSalesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const activeProducts = products.filter((p) => p.isActive !== false);
      const totalSalesCents = sales.reduce((sum, s) => sum + (s.totalCents || 0), 0);
      const grossProfitCents = sales.reduce((sum, s) =>
        sum + (s.items || []).reduce((ps, i) => ps + (i.profitCents || 0), 0), 0);

      const lowStockProducts = activeProducts
        .filter((p) => p.quantity <= (p.minimumQuantity || 0))
        .sort((a, b) => a.quantity - b.quantity);

      const topByProduct = new Map();
      monthSales.forEach((s) => (s.items || []).forEach((item) => {
        const entry = topByProduct.get(item.productId) || { id: item.productId, name: item.productName, totalSold: 0, totalRevenueCents: 0 };
        entry.totalSold += item.quantity;
        entry.totalRevenueCents += item.subtotalCents || 0;
        topByProduct.set(item.productId, entry);
      }));
      const topProducts = [...topByProduct.values()].sort((a, b) => b.totalRevenueCents - a.totalRevenueCents).slice(0, 5);

      const recentSales = [...sales].sort((a, b) =>
        String(b.businessDate).localeCompare(String(a.businessDate))).slice(0, 5);

      setData({
        stats: {
          totalSalesCents,
          grossProfitCents,
          transactions: sales.length,
          totalProducts: activeProducts.length,
          totalStock: activeProducts.reduce((sum, p) => sum + (p.quantity || 0), 0),
          lowStock: lowStockProducts.filter((p) => p.quantity > 0).length,
          outOfStock: activeProducts.filter((p) => p.quantity === 0).length,
        },
        recentSales,
        recentPurchases: purchases,
        lowStockProducts: lowStockProducts.slice(0, 8),
        topProducts,
        recentMovements: movements,
      });
    } catch (e) {
      console.error('Dashboard loading error:', e);
      setError(e?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const today = new Date(`${getBusinessDate()}T12:00:00+03:00`).toLocaleDateString('en-GB', {
    timeZone: 'Africa/Kigali',
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const isAdmin = user?.role === 'admin';
  const nav = (path) => navigate(path);

  return (
    <div className="db-layout">
      <aside className="db-sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo">VI</div>
          <div>
            <p className="brand-name">Verity</p>
            <p className="brand-sub">Inventory</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button type="button" className="nav-item nav-item-active" onClick={() => nav('/dashboard')}>Dashboard</button>
          <button type="button" className="nav-item" onClick={() => nav('/products')}>Products</button>
          <button type="button" className="nav-item" onClick={() => nav('/stock')}>Stock</button>
          <button type="button" className="nav-item" onClick={() => nav('/new-sale')}>New Sale</button>
          <button type="button" className="nav-item" onClick={() => nav('/sales')}>Sales History</button>
          {isAdmin && (
            <>
              <button type="button" className="nav-item" onClick={() => nav('/new-purchase')}>New Purchase</button>
              <button type="button" className="nav-item" onClick={() => nav('/purchases')}>Purchases</button>
              <button type="button" className="nav-item" onClick={() => nav('/reports')}>Reports</button>
              <div className="nav-divider" />
              <button type="button" className="nav-item" onClick={() => nav('/add-product')}>Add Product</button>
              <button type="button" className="nav-item" onClick={() => nav('/add-category')}>Categories</button>
              <button type="button" className="nav-item" onClick={() => nav('/stock-adjustment')}>Stock Adjust</button>
              <button type="button" className="nav-item" onClick={() => nav('/add-expense')}>Add Expense</button>
              <button type="button" className="nav-item" onClick={() => nav('/users')}>Manage Users</button>
            </>
          )}
          {!isAdmin && (
            <>
              <div className="nav-divider" />
              <button type="button" className="nav-item" onClick={() => nav('/purchases')}>Purchases</button>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="profile-avatar">{(user?.name || 'U')[0].toUpperCase()}</div>
            <div>
              <p className="sidebar-username">{user?.name || 'User'}</p>
              <p className="sidebar-role">{user?.role || 'staff'}</p>
            </div>
          </div>
          <button type="button" className="logout-btn" onClick={() => { logout(); navigate('/login'); }}>Logout</button>
        </div>
      </aside>

      <main className="db-main">
        <div className="db-topbar">
          <div>
            <h1 className="db-title">Dashboard</h1>
            <p className="db-date">{today}</p>
          </div>
          <button type="button" className="btn-primary" onClick={() => nav('/new-sale')}>+ New Sale</button>
        </div>

        {loading && <div className="db-loading">Loading dashboard…</div>}
        {error && (
          <div className="db-error">
            {error}
            <button type="button" onClick={load} className="link-btn">Retry</button>
          </div>
        )}

        {data && (
          <>
            <div className="stat-grid">
              <div className="stat-card stat-blue">
                <p className="stat-label">Today's Revenue</p>
                <p className="stat-value">{formatMoney(data.stats.totalSalesCents)}</p>
              </div>
              <div className="stat-card stat-green">
                <p className="stat-label">Today's Gross Profit</p>
                <p className="stat-value">{formatMoney(data.stats.grossProfitCents)}</p>
              </div>
              <div className="stat-card stat-purple">
                <p className="stat-label">Transactions Today</p>
                <p className="stat-value">{data.stats.transactions}</p>
              </div>
              <div className="stat-card stat-slate">
                <p className="stat-label">Total Products</p>
                <p className="stat-value">{data.stats.totalProducts}</p>
              </div>
              <div className="stat-card stat-slate">
                <p className="stat-label">Total Stock Units</p>
                <p className="stat-value">{data.stats.totalStock}</p>
              </div>
              <div className="stat-card stat-yellow">
                <p className="stat-label">Low Stock Items</p>
                <p className="stat-value">{data.stats.lowStock}</p>
              </div>
              <div className="stat-card stat-red">
                <p className="stat-label">Out of Stock</p>
                <p className="stat-value">{data.stats.outOfStock}</p>
              </div>
              <div className="stat-card stat-slate">
                <p className="stat-label">Quick Actions</p>
                <div className="quick-btns">
                  {isAdmin && <button type="button" onClick={() => nav('/new-purchase')} className="qbtn">Purchase</button>}
                  {isAdmin && <button type="button" onClick={() => nav('/reports')} className="qbtn">Reports</button>}
                </div>
              </div>
            </div>

            <div className="db-row">
              <div className="db-card">
                <div className="db-card-header">
                  <h2>Recent Sales</h2>
                  <button type="button" className="link-btn" onClick={() => nav('/sales')}>View all →</button>
                </div>
                {data.recentSales.length === 0 ? (
                  <p className="empty-msg">No sales recorded yet.</p>
                ) : (
                  <table className="mini-table">
                    <thead><tr><th>Date</th><th>By</th><th>Amount</th></tr></thead>
                    <tbody>
                      {data.recentSales.map((s) => (
                        <tr key={s.id}>
                          <td>{fmtDate(s.businessDate)}</td>
                          <td>{s.userName}</td>
                          <td className="amount-cell">{formatMoney(s.totalCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="db-card">
                <div className="db-card-header">
                  <h2>Recent Purchases</h2>
                  {isAdmin && <button type="button" className="link-btn" onClick={() => nav('/purchases')}>View all →</button>}
                </div>
                {data.recentPurchases.length === 0 ? (
                  <p className="empty-msg">No purchases recorded yet.</p>
                ) : (
                  <table className="mini-table">
                    <thead><tr><th>Date</th><th>By</th><th>Amount</th></tr></thead>
                    <tbody>
                      {data.recentPurchases.map((p) => (
                        <tr key={p.id}>
                          <td>{fmtDate(p.businessDate)}</td>
                          <td>{p.userName}</td>
                          <td className="amount-cell">{formatMoney(p.totalCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="db-row">
              <div className="db-card">
                <div className="db-card-header">
                  <h2>⚠️ Low Stock Alerts</h2>
                  <button type="button" className="link-btn" onClick={() => nav('/stock')}>View stock →</button>
                </div>
                {data.lowStockProducts.length === 0 ? (
                  <p className="empty-msg" style={{ color: '#16a34a' }}>✅ All products are well stocked!</p>
                ) : (
                  <table className="mini-table">
                    <thead><tr><th>Product</th><th>Category</th><th>Qty</th><th>Min</th></tr></thead>
                    <tbody>
                      {data.lowStockProducts.map((p) => (
                        <tr key={p.id}>
                          <td>{p.name}</td>
                          <td>{p.categoryName || '—'}</td>
                          <td>
                            <span className={`status-badge ${p.quantity === 0 ? 'badge-red' : 'badge-yellow'}`}>{p.quantity}</span>
                          </td>
                          <td>{p.minimumQuantity || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="db-card">
                <div className="db-card-header">
                  <h2>🏆 Top Products (This Month)</h2>
                  {isAdmin && <button type="button" className="link-btn" onClick={() => nav('/reports')}>Reports →</button>}
                </div>
                {data.topProducts.length === 0 ? (
                  <p className="empty-msg">No sales this month yet.</p>
                ) : (
                  <table className="mini-table">
                    <thead><tr><th>Product</th><th>Sold</th><th>Revenue</th></tr></thead>
                    <tbody>
                      {data.topProducts.map((p, i) => (
                        <tr key={p.id}>
                          <td><span className="rank-num">{i + 1}</span> {p.name}</td>
                          <td>{p.totalSold} pcs</td>
                          <td className="amount-cell">{formatMoney(p.totalRevenueCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="db-card">
              <div className="db-card-header">
                <h2>Recent Stock Movements</h2>
                <button type="button" className="link-btn" onClick={() => nav('/stock')}>View all →</button>
              </div>
              {data.recentMovements.length === 0 ? (
                <p className="empty-msg">No stock movements yet.</p>
              ) : (
                <table className="mini-table">
                  <thead><tr><th>Product</th><th>Type</th><th>Qty</th><th>By</th><th>Date</th></tr></thead>
                  <tbody>
                    {data.recentMovements.map((m) => (
                      <tr key={m.id}>
                        <td>{m.productName}</td>
                        <td>{movementBadge(m.type)}</td>
                        <td>{m.quantity}</td>
                        <td>{m.userName}</td>
                        <td>{fmtDate(m.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

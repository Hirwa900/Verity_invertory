import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = 'https://verity-inventory-backend.onrender.com/api';

function fmt(value) {
  return Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(dateStr) {
  if (!dateStr) return 'â€”';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const user = JSON.parse(localStorage.getItem('authUser') || '{}');

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    navigate('/login');
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('authToken');
      const res = await axios.get(`${API}/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="db-layout">
      {/* Sidebar */}
      <aside className="db-sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo">VI</div>
          <div>
            <p className="brand-name">Verity</p>
            <p className="brand-sub">Inventory</p>
          </div>
        </div>
        <nav className="sidebar-nav">
          <button type="button" className="nav-item nav-item-active" onClick={() => navigate('/dashboard')}>
            <span className="nav-icon">ðŸ“Š</span> Dashboard
          </button>
          <button type="button" className="nav-item" onClick={() => navigate('/products')}>
            <span className="nav-icon">ðŸ“¦</span> Products
          </button>
          <button type="button" className="nav-item" onClick={() => navigate('/stock')}>
            <span className="nav-icon">ðŸ—„ï¸</span> Stock
          </button>
          <button type="button" className="nav-item" onClick={() => navigate('/new-sale')}>
            <span className="nav-icon">ðŸ›’</span> New Sale
          </button>
          <button type="button" className="nav-item" onClick={() => navigate('/sales')}>
            <span className="nav-icon">ðŸ“‹</span> Sales History
          </button>
          <button type="button" className="nav-item" onClick={() => navigate('/new-purchase')}>
            <span className="nav-icon">ðŸ“¥</span> New Purchase
          </button>
          <button type="button" className="nav-item" onClick={() => navigate('/purchases')}>
            <span className="nav-icon">ðŸ§¾</span> Purchases
          </button>
          <button type="button" className="nav-item" onClick={() => navigate('/reports')}>
            <span className="nav-icon">ðŸ“ˆ</span> Reports
          </button>
          {user.role === 'admin' && (
            <>
              <div className="nav-divider" />
              <button type="button" className="nav-item" onClick={() => navigate('/add-product')}>
                <span className="nav-icon">âž•</span> Add Product
              </button>
              <button type="button" className="nav-item" onClick={() => navigate('/add-category')}>
                <span className="nav-icon">ðŸ·ï¸</span> Categories
              </button>
              <button type="button" className="nav-item" onClick={() => navigate('/stock-adjustment')}>
                <span className="nav-icon">âš™ï¸</span> Stock Adjust
              </button>
              <button type="button" className="nav-item" onClick={() => navigate('/add-expense')}>
                <span className="nav-icon">ðŸ’¸</span> Add Expense
              </button>
              <button type="button" className="nav-item" onClick={() => navigate('/users')}>
                <span className="nav-icon">ðŸ‘¥</span> Manage Users
              </button>
            </>
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="profile-avatar">{(user.name || 'U')[0].toUpperCase()}</div>
            <div>
              <p className="sidebar-username">{user.name || 'User'}</p>
              <p className="sidebar-role">{user.role || 'staff'}</p>
            </div>
          </div>
          <button type="button" className="logout-btn" onClick={logout}>Logout</button>
        </div>
      </aside>

      {/* Main */}
      <main className="db-main">
        {/* Top bar */}
        <div className="db-topbar">
          <div>
            <h1 className="db-title">Dashboard</h1>
            <p className="db-date">{today}</p>
          </div>
          <button type="button" className="btn-primary" onClick={() => navigate('/new-sale')}>+ New Sale</button>
        </div>

        {loading && <div className="db-loading">Loading dashboardâ€¦</div>}
        {error && <div className="db-error">{error} <button type="button" onClick={load} className="link-btn">Retry</button></div>}

        {data && (
          <>
            {/* Stat Cards */}
            <div className="stat-grid">
              <div className="stat-card stat-blue">
                <p className="stat-label">Today's Revenue</p>
                <p className="stat-value">RWF {fmt(data.stats.total_sales)}</p>
              </div>
              <div className="stat-card stat-green">
                <p className="stat-label">Today's Gross Profit</p>
                <p className="stat-value">RWF {fmt(data.stats.gross_profit)}</p>
              </div>
              <div className="stat-card stat-purple">
                <p className="stat-label">Transactions Today</p>
                <p className="stat-value">{data.stats.transactions}</p>
              </div>
              <div className="stat-card stat-slate">
                <p className="stat-label">Total Products</p>
                <p className="stat-value">{data.stats.total_products}</p>
              </div>
              <div className="stat-card stat-slate">
                <p className="stat-label">Total Stock Units</p>
                <p className="stat-value">{fmt(data.stats.total_stock)}</p>
              </div>
              <div className="stat-card stat-yellow">
                <p className="stat-label">Low Stock Items</p>
                <p className="stat-value">{data.stats.low_stock}</p>
              </div>
              <div className="stat-card stat-red">
                <p className="stat-label">Out of Stock</p>
                <p className="stat-value">{data.stats.out_of_stock}</p>
              </div>
              <div className="stat-card stat-slate">
                <p className="stat-label">Quick Actions</p>
                <div className="quick-btns">
                  <button type="button" onClick={() => navigate('/new-purchase')} className="qbtn">Purchase</button>
                  <button type="button" onClick={() => navigate('/reports')} className="qbtn">Reports</button>
                </div>
              </div>
            </div>

            {/* Two column row */}
            <div className="db-row">
              {/* Recent Sales */}
              <div className="db-card">
                <div className="db-card-header">
                  <h2>Recent Sales</h2>
                  <button type="button" className="link-btn" onClick={() => navigate('/sales')}>View all â†’</button>
                </div>
                {data.recent_sales.length === 0 ? (
                  <p className="empty-msg">No sales recorded yet.</p>
                ) : (
                  <table className="mini-table">
                    <thead><tr><th>Date</th><th>By</th><th>Amount</th></tr></thead>
                    <tbody>
                      {data.recent_sales.map((s) => (
                        <tr key={s.id}>
                          <td>{fmtDate(s.sale_date)}</td>
                          <td>{s.user_name}</td>
                          <td className="amount-cell">RWF {fmt(s.total_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Recent Purchases */}
              <div className="db-card">
                <div className="db-card-header">
                  <h2>Recent Purchases</h2>
                  <button type="button" className="link-btn" onClick={() => navigate('/purchases')}>View all â†’</button>
                </div>
                {data.recent_purchases.length === 0 ? (
                  <p className="empty-msg">No purchases recorded yet.</p>
                ) : (
                  <table className="mini-table">
                    <thead><tr><th>Date</th><th>By</th><th>Amount</th></tr></thead>
                    <tbody>
                      {data.recent_purchases.map((p) => (
                        <tr key={p.id}>
                          <td>{fmtDate(p.purchase_date)}</td>
                          <td>{p.user_name}</td>
                          <td className="amount-cell">RWF {fmt(p.total_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Second row */}
            <div className="db-row">
              {/* Low Stock Alerts */}
              <div className="db-card">
                <div className="db-card-header">
                  <h2>âš ï¸ Low Stock Alerts</h2>
                  <button type="button" className="link-btn" onClick={() => navigate('/stock')}>View stock â†’</button>
                </div>
                {data.low_stock_products.length === 0 ? (
                  <p className="empty-msg" style={{ color: '#16a34a' }}>âœ… All products are well stocked!</p>
                ) : (
                  <table className="mini-table">
                    <thead><tr><th>Product</th><th>Category</th><th>Qty</th><th>Min</th></tr></thead>
                    <tbody>
                      {data.low_stock_products.map((p) => (
                        <tr key={p.id}>
                          <td>{p.name}</td>
                          <td>{p.category_name || 'â€”'}</td>
                          <td>
                            <span className={`status-badge ${p.current_quantity === 0 ? 'badge-red' : 'badge-yellow'}`}>
                              {p.current_quantity}
                            </span>
                          </td>
                          <td>{p.minimum_quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Top Selling Products */}
              <div className="db-card">
                <div className="db-card-header">
                  <h2>ðŸ† Top Products (This Month)</h2>
                  <button type="button" className="link-btn" onClick={() => navigate('/reports')}>Reports â†’</button>
                </div>
                {data.top_products.length === 0 ? (
                  <p className="empty-msg">No sales this month yet.</p>
                ) : (
                  <table className="mini-table">
                    <thead><tr><th>Product</th><th>Sold</th><th>Revenue</th></tr></thead>
                    <tbody>
                      {data.top_products.map((p, i) => (
                        <tr key={p.id}>
                          <td><span className="rank-num">{i + 1}</span> {p.name}</td>
                          <td>{p.total_sold} pcs</td>
                          <td className="amount-cell">RWF {fmt(p.total_revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Stock Movements */}
            <div className="db-card">
              <div className="db-card-header">
                <h2>Recent Stock Movements</h2>
                <button type="button" className="link-btn" onClick={() => navigate('/stock')}>View all â†’</button>
              </div>
              {data.recent_movements.length === 0 ? (
                <p className="empty-msg">No stock movements yet.</p>
              ) : (
                <table className="mini-table">
                  <thead><tr><th>Product</th><th>Type</th><th>Qty</th><th>By</th><th>Date</th></tr></thead>
                  <tbody>
                    {data.recent_movements.map((m) => (
                      <tr key={m.id}>
                        <td>{m.product_name}</td>
                        <td>{movementBadge(m.movement_type)}</td>
                        <td>{m.quantity}</td>
                        <td>{m.user_name}</td>
                        <td>{fmtDate(m.created_at)}</td>
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


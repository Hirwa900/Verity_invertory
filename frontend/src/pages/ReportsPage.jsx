import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = 'http://localhost:5000/api';

const PERIODS = [
  { key: 'daily', label: 'Today' },
  { key: 'weekly', label: 'This Week' },
  { key: 'monthly', label: 'This Month' },
  { key: 'yearly', label: 'This Year' },
  { key: 'custom', label: 'Custom' },
];

function fmt(v) { return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }

export default function ReportsPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('daily');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchReport = async (p) => {
    setError(null);
    setLoading(true);
    setReport(null);
    const token = localStorage.getItem('authToken');
    try {
      const url = p === 'custom'
        ? `${API}/reports/custom?startDate=${customStart}&endDate=${customEnd}`
        : `${API}/reports/${p}`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      setReport(res.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Unable to load report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport('daily'); }, []);

  const handlePeriod = (p) => {
    setPeriod(p);
    if (p !== 'custom') fetchReport(p);
  };

  return (
    <div className="inner-page">
      <div className="inner-page-card wide-card">
        <div className="inner-page-header">
          <button type="button" className="back-btn" onClick={() => navigate('/dashboard')}>← Dashboard</button>
          <h1>Reports</h1>
          <p className="page-sub">View sales performance, revenue, and profit by period.</p>
        </div>

        {/* Period selector */}
        <div className="period-tabs">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`period-tab ${period === p.key ? 'period-tab-active' : ''}`}
              onClick={() => handlePeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="custom-range-row">
            <div className="field-group">
              <label>From</label>
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
            </div>
            <div className="field-group">
              <label>To</label>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => fetchReport('custom')}
              disabled={!customStart || !customEnd}
            >
              Generate
            </button>
          </div>
        )}

        {loading && <div className="db-loading">Generating report…</div>}
        {error && <div className="form-error-box">{error}</div>}

        {report && (
          <>
            <div className="report-period-label">
              {report.startDate && report.endDate && report.startDate !== report.endDate
                ? `${report.startDate} → ${report.endDate}`
                : report.date || report.startDate}
            </div>

            {/* Summary cards */}
            <div className="report-stat-grid">
              <div className="report-stat-card">
                <p className="stat-label">Total Revenue</p>
                <p className="stat-value text-blue">RWF {fmt(report.total_sales)}</p>
              </div>
              <div className="report-stat-card">
                <p className="stat-label">Cost of Goods</p>
                <p className="stat-value">RWF {fmt(report.cost_of_goods)}</p>
              </div>
              <div className="report-stat-card">
                <p className="stat-label">Gross Profit</p>
                <p className="stat-value text-green">RWF {fmt(report.gross_profit)}</p>
              </div>
              <div className="report-stat-card">
                <p className="stat-label">Expenses</p>
                <p className="stat-value text-red">RWF {fmt(report.expenses)}</p>
              </div>
              <div className="report-stat-card">
                <p className="stat-label">Net Profit</p>
                <p className={`stat-value ${report.net_profit >= 0 ? 'text-green' : 'text-red'}`}>
                  RWF {fmt(report.net_profit)}
                </p>
              </div>
              <div className="report-stat-card">
                <p className="stat-label">Transactions</p>
                <p className="stat-value text-purple">{report.transactions}</p>
              </div>
              <div className="report-stat-card">
                <p className="stat-label">Items Sold</p>
                <p className="stat-value">{report.items_sold}</p>
              </div>
            </div>

            {/* Top products table */}
            {report.top_products && report.top_products.length > 0 && (
              <div className="report-section">
                <h2 className="report-section-title">Top Selling Products</h2>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Product Name</th>
                      <th>Units Sold</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.top_products.map((p, i) => (
                      <tr key={p.id}>
                        <td><span className="rank-num">{i + 1}</span></td>
                        <td>{p.name}</td>
                        <td>{p.total_sold}</td>
                        <td className="amount-cell">RWF {fmt(p.total_revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {report.top_products && report.top_products.length === 0 && (
              <p className="empty-msg" style={{ marginTop: '2rem' }}>No sales in this period.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

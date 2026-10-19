import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listExpenses, listSales } from '../lib/collections';
import { formatRWF } from '../lib/money';
import getBusinessDate, { monthStart } from '../lib/businessDate';

const PERIODS = [
  { key: 'daily', label: 'Today' },
  { key: 'weekly', label: 'This Week' },
  { key: 'monthly', label: 'This Month' },
  { key: 'yearly', label: 'This Year' },
  { key: 'custom', label: 'Custom' },
];

function periodRange(period) {
  const today = getBusinessDate();
  const pad = (n) => String(n).padStart(2, '0');
  const d = new Date();
  const kigaliNow = new Date(d.toLocaleString('en-US', { timeZone: 'Africa/Kigali' }));
  switch (period) {
    case 'daily':
      return { startDate: today, endDate: today };
    case 'weekly': {
      const day = kigaliNow.getDay();
      const start = new Date(kigaliNow);
      start.setDate(kigaliNow.getDate() - ((day + 6) % 7));
      const startDate = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
      return { startDate, endDate: today };
    }
    case 'monthly':
      return { startDate: monthStart(), endDate: today };
    case 'yearly':
      return { startDate: `${today.slice(0, 4)}-01-01`, endDate: today };
    default:
      return { startDate: today, endDate: today };
  }
}

export function computeReport(sales, expenses, startDate, endDate) {
  const activeSales = sales.filter((s) => s.isActive !== false);
  const totalSalesCents = activeSales.reduce((sum, s) => sum + (s.totalCents || 0), 0);
  const costOfGoodsCents = activeSales.reduce((sum, s) =>
    sum + (s.items || []).reduce((itemSum, i) =>
      itemSum + (i.buyingPriceCents || 0) * (i.quantity || 0), 0), 0);
  const grossProfitCents = totalSalesCents - costOfGoodsCents;
  const expensesCents = expenses.reduce((sum, e) => sum + (e.amountCents || 0), 0);
  const itemsSold = activeSales.reduce((sum, s) =>
    sum + (s.items || []).reduce((itemSum, i) => itemSum + (i.quantity || 0), 0), 0);

  const topByProduct = new Map();
  activeSales.forEach((s) => (s.items || []).forEach((item) => {
    const entry = topByProduct.get(item.productId) || {
      id: item.productId, name: item.productName, totalSold: 0, totalRevenueCents: 0,
    };
    entry.totalSold += item.quantity;
    entry.totalRevenueCents += item.subtotalCents || 0;
    topByProduct.set(item.productId, entry);
  }));
  const topProducts = [...topByProduct.values()]
    .sort((a, b) => b.totalRevenueCents - a.totalRevenueCents)
    .slice(0, 10);

  return {
    startDate,
    endDate,
    totalSalesCents,
    costOfGoodsCents,
    grossProfitCents,
    expensesCents,
    netProfitCents: grossProfitCents - expensesCents,
    transactions: activeSales.length,
    itemsSold,
    topProducts,
  };
}

export default function ReportsPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('daily');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchReport = async (p, startOverride, endOverride) => {
    setError(null);
    setLoading(true);
    setReport(null);
    try {
      const range = startOverride && endOverride
        ? { startDate: startOverride, endDate: endOverride }
        : periodRange(p);
      const [sales, expenses] = await Promise.all([
        listSales({ activeOnly: false }),
        listExpenses({ startDate: range.startDate, endDate: range.endDate }),
      ]);
      const inRange = sales.filter((s) =>
        s.businessDate >= range.startDate && s.businessDate <= range.endDate);
      setReport(computeReport(inRange, expenses, range.startDate, range.endDate));
    } catch (e) {
      console.error('Report error:', e);
      setError('Unable to load report');
    } finally {
      setLoading(false);
    }
  };

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
              onClick={() => fetchReport('custom', customStart, customEnd)}
              disabled={!customStart || !customEnd || customStart > customEnd}
            >
              Generate
            </button>
            {customStart && customEnd && customStart > customEnd && (
              <p className="form-error">The start date must be on or before the end date.</p>
            )}
          </div>
        )}

        {loading && <div className="db-loading">Generating report…</div>}
        {error && <div className="form-error-box">{error}</div>}

        {report && (
          <>
            <div className="report-period-label">
              {report.startDate !== report.endDate
                ? `${report.startDate} → ${report.endDate}`
                : report.startDate}
            </div>

            <div className="report-stat-grid">
              <div className="report-stat-card">
                <p className="stat-label">Total Revenue</p>
                <p className="stat-value text-blue">{formatRWF(report.totalSalesCents)}</p>
              </div>
              <div className="report-stat-card">
                <p className="stat-label">Cost of Goods</p>
                <p className="stat-value">{formatRWF(report.costOfGoodsCents)}</p>
              </div>
              <div className="report-stat-card">
                <p className="stat-label">Gross Profit</p>
                <p className="stat-value text-green">{formatRWF(report.grossProfitCents)}</p>
              </div>
              <div className="report-stat-card">
                <p className="stat-label">Expenses</p>
                <p className="stat-value text-red">{formatRWF(report.expensesCents)}</p>
              </div>
              <div className="report-stat-card">
                <p className="stat-label">Net Profit</p>
                <p className={`stat-value ${report.netProfitCents >= 0 ? 'text-green' : 'text-red'}`}>
                  {formatRWF(report.netProfitCents)}
                </p>
              </div>
              <div className="report-stat-card">
                <p className="stat-label">Transactions</p>
                <p className="stat-value text-purple">{report.transactions}</p>
              </div>
              <div className="report-stat-card">
                <p className="stat-label">Items Sold</p>
                <p className="stat-value">{report.itemsSold}</p>
              </div>
            </div>

            {report.topProducts.length > 0 ? (
              <div className="report-section">
                <h2 className="report-section-title">Top Selling Products</h2>
                <table className="data-table">
                  <thead>
                    <tr><th>#</th><th>Product Name</th><th>Units Sold</th><th>Revenue</th></tr>
                  </thead>
                  <tbody>
                    {report.topProducts.map((p, i) => (
                      <tr key={p.id}>
                        <td><span className="rank-num">{i + 1}</span></td>
                        <td>{p.name}</td>
                        <td>{p.totalSold}</td>
                        <td className="amount-cell">RWF {formatRWF(p.totalRevenueCents, { decimals: 0 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-msg" style={{ marginTop: '2rem' }}>No sales in this period.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

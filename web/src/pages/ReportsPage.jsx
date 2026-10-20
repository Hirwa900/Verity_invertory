import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { listExpenses, listSales } from '../lib/collections';
import { formatRWF } from '../lib/money';
import getBusinessDate, { monthStart } from '../lib/businessDate';
import { dataRevision } from '../lib/queryCache';

const PERIODS = [
  { key: 'daily', label: 'Today' },
  { key: 'weekly', label: 'This Week' },
  { key: 'monthly', label: 'This Month' },
  { key: 'yearly', label: 'This Year' },
  { key: 'custom', label: 'Custom' },
];

// Reports are cached only until a business write happens in this session
// (dataRevision changes) or until REPORT_TTL_MS passes, whichever comes first,
// so a report is never presented as final when it is older than that window.
const REPORT_TTL_MS = 30 * 1000;
const reportCache = new Map();

export function readReportCache(range, revision = dataRevision(), now = Date.now()) {
  const key = `${range.startDate}|${range.endDate}`;
  const entry = reportCache.get(key);
  if (!entry) return null;
  if (entry.revision !== revision || now - entry.at >= REPORT_TTL_MS) {
    reportCache.delete(key);
    return null;
  }
  return entry;
}

export function writeReportCache(range, report, revision = dataRevision(), now = Date.now()) {
  reportCache.set(`${range.startDate}|${range.endDate}`, { report, at: now, revision });
}

export function clearReportCache() {
  reportCache.clear();
}

export function periodRange(period) {
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);
  const initRef = useRef(false);

  const fetchReport = async (p, startOverride, endOverride, { force = false, ignoreLoadingGuard = false } = {}) => {
    if (loading && !ignoreLoadingGuard) return;
    setError(null);
    setLoading(true);
    setLastFetch({ p, startOverride, endOverride });
    try {
      const range = startOverride && endOverride
        ? { startDate: startOverride, endDate: endOverride }
        : periodRange(p);

      if (!force) {
        const cached = readReportCache(range);
        if (cached) {
          setReport(cached.report);
          setFetchedAt(cached.at);
          setLoading(false);
          return;
        }
      }

      // Never keep an older period's totals on screen while fresh data loads.
      setReport(null);
      setFetchedAt(null);
      const [sales, expenses] = await Promise.all([
        listSales({ activeOnly: true, startDate: range.startDate, endDate: range.endDate }),
        listExpenses({ startDate: range.startDate, endDate: range.endDate }),
      ]);
      const inRange = sales.filter((s) =>
        s.businessDate >= range.startDate && s.businessDate <= range.endDate);
      const nextReport = computeReport(inRange, expenses, range.startDate, range.endDate);
      const at = Date.now();
      writeReportCache(range, nextReport, dataRevision(), at);
      setReport(nextReport);
      setFetchedAt(at);
    } catch (e) {
      console.error('Report error:', e);
      setReport(null);
      setFetchedAt(null);
      setError('Unable to load report. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePeriod = (p) => {
    if (loading) return;
    setPeriod(p);
    if (p !== 'custom') {
      fetchReport(p);
      return;
    }
    // Custom range: drop the previous period's totals so nothing on screen can
    // be mistaken for the range the user is about to pick.
    setReport(null);
    setFetchedAt(null);
    setError(null);
  };

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    fetchReport('daily', null, null, { ignoreLoadingGuard: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatTime = (ms) => new Date(ms).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  const retryLastFetch = (force) => {
    if (!lastFetch) return;
    fetchReport(lastFetch.p, lastFetch.startOverride, lastFetch.endOverride, { force, ignoreLoadingGuard: true });
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
              disabled={loading}
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
              disabled={loading || !customStart || !customEnd || customStart > customEnd}
            >
              Generate
            </button>
            {customStart && customEnd && customStart > customEnd && (
              <p className="form-error">The start date must be on or before the end date.</p>
            )}
          </div>
        )}

        {loading && <div className="db-loading">Generating report…</div>}
        {error && (
          <div className="form-error-box">
            {error}
            {lastFetch && (
              <button
                type="button"
                className="btn-primary"
                style={{ marginLeft: '0.75rem' }}
                onClick={() => retryLastFetch(true)}
              >
                Try again
              </button>
            )}
          </div>
        )}
        {!report && !loading && !error && (
          <p className="empty-msg" style={{ marginTop: '2rem' }}>
            {period === 'custom'
              ? 'Choose a date range above, then select Generate.'
              : 'Choose a period above to generate a report.'}
          </p>
        )}

        {report && !loading && (
          <>
            <div className="report-period-label">
              {report.startDate !== report.endDate
                ? `${report.startDate} → ${report.endDate}`
                : report.startDate}
            </div>
            {fetchedAt && (
              <p className="page-sub" style={{ marginTop: '-0.5rem' }}>
                Updated {formatTime(fetchedAt)}
                <button type="button" className="link-btn" style={{ marginLeft: '0.5rem' }} onClick={() => retryLastFetch(true)}>
                  Refresh
                </button>
              </p>
            )}

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
              <p className="empty-msg" style={{ marginTop: '2rem' }}>
                {report.transactions === 0
                  ? (report.expensesCents > 0
                    ? 'No sales recorded for this period — the expenses above are still included.'
                    : 'No sales or expenses recorded for this period.')
                  : 'No product-level sales data for this period.'}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

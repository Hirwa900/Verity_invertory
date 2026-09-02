const pool = require('../config/db');

const buildReport = async (startDate, endDate) => {
  const startTs = `${startDate} 00:00:00`;
  const endTs = `${endDate} 23:59:59`;

  const salesTotals = await pool.query(
    `SELECT SUM(total_amount) AS total_sales,
            COUNT(*) AS transactions
     FROM sales
     WHERE sale_date BETWEEN $1 AND $2`,
    [startTs, endTs]
  );

  const itemTotals = await pool.query(
    `SELECT SUM(si.buying_price * si.quantity) AS cost_of_goods,
            SUM(si.profit) AS gross_profit,
            SUM(si.quantity) AS items_sold
     FROM sale_items si
     JOIN sales s ON si.sale_id = s.id
     WHERE s.sale_date BETWEEN $1 AND $2`,
    [startTs, endTs]
  );

  const expenses = await pool.query(
    `SELECT SUM(amount) AS total_expenses FROM expenses WHERE expense_date BETWEEN $1 AND $2`,
    [startTs, endTs]
  );

  const topProducts = await pool.query(
    `SELECT p.id, p.name, SUM(si.quantity) AS total_sold, SUM(si.subtotal) AS total_revenue
     FROM sale_items si
     JOIN sales s ON si.sale_id = s.id
     JOIN products p ON si.product_id = p.id
     WHERE s.sale_date BETWEEN $1 AND $2
     GROUP BY p.id, p.name
     ORDER BY total_sold DESC
     LIMIT 10`,
    [startTs, endTs]
  );

  const grossProfit = Number(itemTotals.rows[0].gross_profit || 0);
  const totalExpenses = Number(expenses.rows[0].total_expenses || 0);

  const report = {
    total_sales: Number(salesTotals.rows[0].total_sales || 0),
    cost_of_goods: Number(itemTotals.rows[0].cost_of_goods || 0),
    gross_profit: grossProfit,
    expenses: totalExpenses,
    net_profit: grossProfit - totalExpenses,
    items_sold: Number(itemTotals.rows[0].items_sold || 0),
    transactions: Number(salesTotals.rows[0].transactions || 0),
    top_products: topProducts.rows.map((p) => ({
      id: p.id,
      name: p.name,
      total_sold: Number(p.total_sold),
      total_revenue: Number(p.total_revenue),
    })),
  };

  return report;
};

const getDailyReport = async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  try {
    const report = await buildReport(today, today);
    res.json({ period: 'daily', date: today, startDate: today, endDate: today, ...report });
  } catch (error) {
    res.status(500).json({ message: 'Unable to generate daily report', error: error.message });
  }
};

const getWeeklyReport = async (req, res) => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const firstDay = new Date(today);
  firstDay.setDate(today.getDate() - dayOfWeek);
  const lastDay = new Date(firstDay);
  lastDay.setDate(firstDay.getDate() + 6);

  const startDate = firstDay.toISOString().split('T')[0];
  const endDate = lastDay.toISOString().split('T')[0];

  try {
    const report = await buildReport(startDate, endDate);
    res.json({ period: 'weekly', startDate, endDate, ...report });
  } catch (error) {
    res.status(500).json({ message: 'Unable to generate weekly report', error: error.message });
  }
};

const getMonthlyReport = async (req, res) => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const daysInMonth = new Date(year, date.getMonth() + 1, 0).getDate();
  const startDate = `${year}-${month}-01`;
  const endDate = `${year}-${month}-${String(daysInMonth).padStart(2, '0')}`;

  try {
    const report = await buildReport(startDate, endDate);
    res.json({ period: 'monthly', year, month, startDate, endDate, ...report });
  } catch (error) {
    res.status(500).json({ message: 'Unable to generate monthly report', error: error.message });
  }
};

const getYearlyReport = async (req, res) => {
  const date = new Date();
  const year = date.getFullYear();
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  try {
    const report = await buildReport(startDate, endDate);
    res.json({ period: 'yearly', year, startDate, endDate, ...report });
  } catch (error) {
    res.status(500).json({ message: 'Unable to generate yearly report', error: error.message });
  }
};

const getCustomReport = async (req, res) => {
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) {
    return res.status(400).json({ message: 'startDate and endDate are required' });
  }

  try {
    const report = await buildReport(startDate, endDate);
    res.json({ period: 'custom', startDate, endDate, ...report });
  } catch (error) {
    res.status(500).json({ message: 'Unable to generate custom report', error: error.message });
  }
};

module.exports = {
  getDailyReport,
  getWeeklyReport,
  getMonthlyReport,
  getYearlyReport,
  getCustomReport,
};

const pool = require('../config/db');

const getDashboard = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const startOfDay = `${today} 00:00:00`;
    const endOfDay = `${today} 23:59:59`;
    const startOfMonth = `${today.slice(0, 7)}-01 00:00:00`;

    const [
      todaySalesTotals,
      todayItemTotals,
      stockSummary,
      recentSales,
      recentPurchases,
      lowStock,
      topProducts,
      recentMovements,
    ] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(total_amount), 0) AS total_sales,
                COUNT(*) AS transactions
         FROM sales
         WHERE sale_date BETWEEN $1 AND $2`,
        [startOfDay, endOfDay]
      ),
      pool.query(
        `SELECT COALESCE(SUM(si.profit), 0) AS gross_profit
         FROM sale_items si
         JOIN sales s ON si.sale_id = s.id
         WHERE s.sale_date BETWEEN $1 AND $2`,
        [startOfDay, endOfDay]
      ),
      pool.query(
        `SELECT COUNT(*) AS total_products,
                COALESCE(SUM(quantity), 0) AS total_stock,
                SUM(CASE WHEN quantity <= minimum_stock AND quantity > 0 THEN 1 ELSE 0 END) AS low_stock,
                SUM(CASE WHEN quantity = 0 THEN 1 ELSE 0 END) AS out_of_stock
         FROM products WHERE is_active = true`
      ),
      pool.query(
        `SELECT s.id, u.name AS user_name, s.sale_date, s.total_amount
         FROM sales s
         LEFT JOIN users u ON s.user_id = u.id
         ORDER BY s.sale_date DESC LIMIT 5`
      ),
      pool.query(
        `SELECT p.id, u.name AS user_name, p.purchase_date, p.total_amount
         FROM purchases p
         LEFT JOIN users u ON p.user_id = u.id
         ORDER BY p.purchase_date DESC LIMIT 5`
      ),
      pool.query(
        `SELECT p.id, p.name, p.quantity AS current_quantity, p.minimum_stock AS minimum_quantity, c.name AS category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.is_active = true AND p.quantity <= p.minimum_stock
         ORDER BY p.quantity ASC LIMIT 10`
      ),
      pool.query(
        `SELECT p.id, p.name, SUM(si.quantity) AS total_sold, SUM(si.subtotal) AS total_revenue
         FROM sale_items si
         JOIN sales s ON si.sale_id = s.id
         JOIN products p ON si.product_id = p.id
         WHERE s.sale_date >= $1
         GROUP BY p.id, p.name
         ORDER BY total_sold DESC LIMIT 5`,
        [startOfMonth]
      ),
      pool.query(
        `SELECT sm.id, p.name AS product_name, sm.movement_type, sm.quantity, u.name AS user_name, sm.created_at
         FROM stock_movements sm
         LEFT JOIN products p ON sm.product_id = p.id
         LEFT JOIN users u ON sm.user_id = u.id
         ORDER BY sm.created_at DESC LIMIT 8`
      ),
    ]);

    res.json({
      today,
      stats: {
        total_sales: Number(todaySalesTotals.rows[0].total_sales),
        gross_profit: Number(todayItemTotals.rows[0].gross_profit),
        transactions: Number(todaySalesTotals.rows[0].transactions),
        total_products: Number(stockSummary.rows[0].total_products),
        total_stock: Number(stockSummary.rows[0].total_stock),
        low_stock: Number(stockSummary.rows[0].low_stock),
        out_of_stock: Number(stockSummary.rows[0].out_of_stock),
      },
      recent_sales: recentSales.rows,
      recent_purchases: recentPurchases.rows,
      low_stock_products: lowStock.rows,
      top_products: topProducts.rows.map((p) => ({ ...p, total_sold: Number(p.total_sold), total_revenue: Number(p.total_revenue) })),
      recent_movements: recentMovements.rows,
    });
  } catch (error) {
    res.status(500).json({ message: 'Unable to load dashboard', error: error.message });
  }
};

module.exports = { getDashboard };

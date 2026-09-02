const pool = require('../config/db');

const listSales = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const { rows } = await pool.query(
      `SELECT s.id, s.user_id, u.name AS user_name, s.sale_date, s.total_amount
       FROM sales s
       LEFT JOIN users u ON s.user_id = u.id
       ${req.user.role === 'cashier' ? 'WHERE s.user_id = $1' : ''}
       ORDER BY s.sale_date DESC LIMIT ${req.user.role === 'cashier' ? '$2' : '$1'}`,
      req.user.role === 'cashier' ? [req.user.id, limit] : [limit]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch sales', error: error.message });
  }
};

const getSale = async (req, res) => {
  const { id } = req.params;

  try {
    const { rows: saleRows } = await pool.query(
      `SELECT s.id, s.user_id, u.name AS user_name, s.sale_date, s.total_amount
       FROM sales s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.id = $1`,
      [id]
    );

    if (!saleRows.length) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    const sale = saleRows[0];
    if (req.user.role === 'cashier' && sale.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { rows: items } = await pool.query(
      `SELECT si.id, si.product_id, pr.name AS product_name, si.quantity, si.selling_price, si.subtotal
       FROM sale_items si
       LEFT JOIN products pr ON si.product_id = pr.id
       WHERE si.sale_id = $1`,
      [id]
    );

    res.json({ ...sale, items });
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch sale', error: error.message });
  }
};

const createSale = async (req, res) => {
  const { sale_date, items } = req.body;
  if (!sale_date || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: 'Sale date and items are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let totalAmount = 0;
    const productCache = new Map();
    for (const item of items) {
      if (!item.product_id || item.quantity === undefined) {
        throw new Error('Each sale item must include product_id and quantity');
      }
      const { rows: productRows } = await client.query('SELECT id, selling_price, buying_price, quantity FROM products WHERE id = $1', [item.product_id]);
      const product = productRows[0];
      if (!product) {
        throw new Error(`Product ${item.product_id} not found`);
      }
      if (product.quantity < item.quantity) {
        throw new Error(`Insufficient stock for product ${product.id}`);
      }
      productCache.set(item.product_id, product);
      totalAmount += item.quantity * product.selling_price;
    }

    const saleResult = await client.query(
      'INSERT INTO sales (user_id, sale_date, total_amount) VALUES ($1, $2, $3) RETURNING id',
      [req.user.id, sale_date, totalAmount]
    );
    const saleId = saleResult.rows[0].id;

    for (const item of items) {
      const product = productCache.get(item.product_id);
      const subtotal = product.selling_price * item.quantity;
      const profit = (product.selling_price - product.buying_price) * item.quantity;

      await client.query(
        'INSERT INTO sale_items (sale_id, product_id, quantity, selling_price, buying_price, subtotal, profit) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [saleId, item.product_id, item.quantity, product.selling_price, product.buying_price, subtotal, profit]
      );

      await client.query(`UPDATE products SET quantity = quantity - $1, updated_at = NOW() WHERE id = $2`, [item.quantity, item.product_id]);

      await client.query(
        `INSERT INTO stock_movements (product_id, user_id, movement_type, quantity, reference_id, note, created_at)
         VALUES ($1, $2, 'SALE', $3, $4, NULL, NOW())`,
        [item.product_id, req.user.id, item.quantity, saleId]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Sale recorded successfully', sale_id: saleId });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Unable to record sale', error: error.message });
  } finally {
    client.release();
  }
};

module.exports = {
  listSales,
  getSale,
  createSale,
};

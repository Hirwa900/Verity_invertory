const pool = require('../config/db');

const listPurchases = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const { rows } = await pool.query(
      `SELECT p.id, p.user_id, u.name AS user_name, p.purchase_date, p.total_amount
       FROM purchases p
       LEFT JOIN users u ON p.user_id = u.id
       ORDER BY p.purchase_date DESC LIMIT $1`,
      [limit]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch purchases', error: error.message });
  }
};

const getPurchase = async (req, res) => {
  const { id } = req.params;

  try {
    const { rows: purchaseRows } = await pool.query(
      `SELECT p.id, p.user_id, u.name AS user_name, p.purchase_date, p.total_amount
       FROM purchases p
       LEFT JOIN users u ON p.user_id = u.id
       WHERE p.id = $1`,
      [id]
    );

    if (!purchaseRows.length) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    const purchase = purchaseRows[0];
    const { rows: items } = await pool.query(
      `SELECT pi.id, pi.product_id, pr.name AS product_name, pi.quantity, pi.buying_price, pi.subtotal
       FROM purchase_items pi
       LEFT JOIN products pr ON pi.product_id = pr.id
       WHERE pi.purchase_id = $1`,
      [id]
    );

    res.json({ ...purchase, items });
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch purchase', error: error.message });
  }
};

const createPurchase = async (req, res) => {
  const { purchase_date, items } = req.body;
  if (!purchase_date || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: 'Purchase date and items are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let totalAmount = 0;
    for (const item of items) {
      if (!item.product_id || item.quantity === undefined || item.buying_price === undefined) {
        throw new Error('Each purchase item must include product_id, quantity, and buying_price');
      }
      totalAmount += item.quantity * item.buying_price;
    }

    const purchaseResult = await client.query(
      'INSERT INTO purchases (user_id, purchase_date, total_amount) VALUES ($1, $2, $3) RETURNING id',
      [req.user.id, purchase_date, totalAmount]
    );
    const purchaseId = purchaseResult.rows[0].id;

    for (const item of items) {
      const subtotal = item.quantity * item.buying_price;
      await client.query(
        'INSERT INTO purchase_items (purchase_id, product_id, quantity, buying_price, subtotal) VALUES ($1, $2, $3, $4, $5)',
        [purchaseId, item.product_id, item.quantity, item.buying_price, subtotal]
      );

      await client.query(
        `UPDATE products SET quantity = quantity + $1, buying_price = $2, updated_at = NOW() WHERE id = $3`,
        [item.quantity, item.buying_price, item.product_id]
      );

      await client.query(
        `INSERT INTO stock_movements (product_id, user_id, movement_type, quantity, reference_id, note, created_at)
         VALUES ($1, $2, 'PURCHASE', $3, $4, NULL, NOW())`,
        [item.product_id, req.user.id, item.quantity, purchaseId]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Purchase created successfully', purchase_id: purchaseId });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Unable to create purchase', error: error.message });
  } finally {
    client.release();
  }
};

module.exports = {
  listPurchases,
  getPurchase,
  createPurchase,
};

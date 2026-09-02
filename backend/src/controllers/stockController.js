const pool = require('../config/db');

const getStock = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 500, 1000);
    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.sku, c.name AS category_name, p.quantity AS current_quantity,
              p.minimum_stock AS minimum_quantity, p.unit, p.is_active,
              p.buying_price, p.selling_price
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       ORDER BY p.name ASC LIMIT $1`,
      [limit]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch stock', error: error.message });
  }
};

const getStockMovements = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT sm.id, sm.product_id, p.name AS product_name, sm.user_id, u.name AS user_name,
              sm.movement_type, sm.quantity, sm.reference_id, sm.note, sm.created_at
       FROM stock_movements sm
       LEFT JOIN products p ON sm.product_id = p.id
       LEFT JOIN users u ON sm.user_id = u.id
       ORDER BY sm.created_at DESC
       LIMIT 100`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch stock movements', error: error.message });
  }
};

const adjustStock = async (req, res) => {
  const { product_id, quantity, movement_type, notes } = req.body;
  if (!product_id || quantity === undefined || !movement_type) {
    return res.status(400).json({ message: 'product_id, quantity, and movement_type are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: productRows } = await client.query('SELECT id, quantity FROM products WHERE id = $1', [product_id]);
    const product = productRows[0];
    if (!product) {
      throw new Error('Product not found');
    }

    const afterQuantity = product.quantity + quantity;
    if (afterQuantity < 0) {
      throw new Error('Stock adjustment would result in negative quantity');
    }

    await client.query('UPDATE products SET quantity = $1, updated_at = NOW() WHERE id = $2', [afterQuantity, product_id]);
    await client.query(
      'INSERT INTO stock_movements (product_id, user_id, movement_type, quantity, reference_id, note, created_at) VALUES ($1, $2, $3, $4, NULL, $5, NOW())',
      [product_id, req.user.id, movement_type, quantity, notes || null]
    );

    await client.query('COMMIT');
    res.status(201).json({ message: 'Stock adjusted successfully', new_quantity: afterQuantity });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Unable to adjust stock', error: error.message });
  } finally {
    client.release();
  }
};

module.exports = {
  getStock,
  getStockMovements,
  adjustStock,
};

const pool = require('../config/db');

const listProducts = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 500, 1000);
    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.sku, p.category_id, c.name AS category_name, p.buying_price, p.selling_price,
              p.quantity AS current_quantity, p.minimum_stock AS minimum_quantity, p.unit,
              p.is_active, p.created_at, p.updated_at
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       ORDER BY p.name ASC LIMIT $1`,
      [limit]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch products', error: error.message });
  }
};

const getProduct = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.sku, p.category_id, c.name AS category_name, p.buying_price, p.selling_price,
              p.quantity AS current_quantity, p.minimum_stock AS minimum_quantity, p.unit,
              p.is_active, p.created_at, p.updated_at
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1`,
      [id]
    );
    const product = rows[0];
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch product', error: error.message });
  }
};

const createProduct = async (req, res) => {
  const { name, category_id, sku, buying_price, selling_price, current_quantity, minimum_quantity, unit } = req.body;
  const numericValues = [buying_price, selling_price, current_quantity];
  if (!name?.trim() || numericValues.some((value) => !Number.isFinite(Number(value)) || Number(value) < 0)) {
    return res.status(400).json({ message: 'Name, buying price, selling price, and quantity are required.' });
  }

  const cleanUnit = unit?.trim() || 'piece';
  const cleanSku = sku?.trim() || `SKU-${Date.now()}`;
  const cleanCategoryId = category_id ? Number(category_id) : null;
  const cleanMinStock = minimum_quantity !== undefined && Number(minimum_quantity) >= 0 ? Number(minimum_quantity) : 0;

  try {
    const { rows } = await pool.query(
      `INSERT INTO products (name, category_id, sku, buying_price, selling_price, quantity, minimum_stock, unit, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) RETURNING id`,
      [name.trim(), cleanCategoryId, cleanSku, Number(buying_price), Number(selling_price), Number(current_quantity), cleanMinStock, cleanUnit, true]
    );
    res.status(201).json({
      id: rows[0].id,
      name: name.trim(),
      category_id: cleanCategoryId,
      sku: cleanSku,
      buying_price: Number(buying_price),
      selling_price: Number(selling_price),
      current_quantity: Number(current_quantity),
      minimum_quantity: cleanMinStock,
      unit: cleanUnit,
      is_active: true
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'A product with this SKU already exists' });
    }
    res.status(500).json({ message: 'Unable to create product', error: error.message });
  }
};

const updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name, category_id, sku, buying_price, selling_price, current_quantity, minimum_quantity, unit, is_active } = req.body;

  try {
    const { rows: existingRows } = await pool.query('SELECT id FROM products WHERE id = $1', [id]);
    if (!existingRows.length) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const query = [];
    const params = [];

    if (name !== undefined) { query.push(`name = $${params.length + 1}`); params.push(name ? name.trim() : ''); }
    if (category_id !== undefined) { query.push(`category_id = $${params.length + 1}`); params.push(category_id ? Number(category_id) : null); }
    if (sku !== undefined) { query.push(`sku = $${params.length + 1}`); params.push(sku ? sku.trim() : null); }
    if (buying_price !== undefined) { query.push(`buying_price = $${params.length + 1}`); params.push(Number(buying_price)); }
    if (selling_price !== undefined) { query.push(`selling_price = $${params.length + 1}`); params.push(Number(selling_price)); }
    if (current_quantity !== undefined) { query.push(`quantity = $${params.length + 1}`); params.push(Number(current_quantity)); }
    if (minimum_quantity !== undefined) { query.push(`minimum_stock = $${params.length + 1}`); params.push(Number(minimum_quantity)); }
    if (unit !== undefined) { query.push(`unit = $${params.length + 1}`); params.push(unit.trim()); }
    if (typeof is_active === 'boolean') { query.push(`is_active = $${params.length + 1}`); params.push(is_active); }

    if (!query.length) {
      return res.status(400).json({ message: 'No valid fields provided for update' });
    }

    query.push('updated_at = NOW()');
    const sql = `UPDATE products SET ${query.join(', ')} WHERE id = $${params.length + 1}`;
    params.push(id);

    await pool.query(sql, params);
    res.json({ message: 'Product updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Unable to update product', error: error.message });
  }
};

const deleteProduct = async (req, res) => {
  const { id } = req.params;

  try {
    const { rows: existingRows } = await pool.query('SELECT id FROM products WHERE id = $1', [id]);
    if (!existingRows.length) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await pool.query('UPDATE products SET is_active = false, updated_at = NOW() WHERE id = $1', [id]);
    res.json({ message: 'Product deactivated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Unable to deactivate product', error: error.message });
  }
};

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
};

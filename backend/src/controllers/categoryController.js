const pool = require('../config/db');

const listCategories = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, description, is_active, created_at, updated_at FROM categories');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch categories', error: error.message });
  }
};

const createCategory = async (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Category name is required' });
  }

  try {
    const { rows } = await pool.query(
      'INSERT INTO categories (name, description, is_active, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id',
      [name, description || null, true]
    );
    res.status(201).json({ id: rows[0].id, name, description: description || null, is_active: true });
  } catch (error) {
    res.status(500).json({ message: 'Unable to create category', error: error.message });
  }
};

const updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name, description, is_active } = req.body;

  try {
    const { rows: existingRows } = await pool.query('SELECT id FROM categories WHERE id = $1', [id]);
    if (!existingRows.length) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const query = [];
    const params = [];

    if (name) { query.push(`name = $${params.length + 1}`); params.push(name); }
    if (description !== undefined) { query.push(`description = $${params.length + 1}`); params.push(description); }
    if (typeof is_active === 'boolean') { query.push(`is_active = $${params.length + 1}`); params.push(is_active); }

    if (!query.length) {
      return res.status(400).json({ message: 'No valid fields provided for update' });
    }

    query.push('updated_at = NOW()');
    const sql = `UPDATE categories SET ${query.join(', ')} WHERE id = $${params.length + 1}`;
    params.push(id);

    await pool.query(sql, params);
    res.json({ message: 'Category updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Unable to update category', error: error.message });
  }
};

const deleteCategory = async (req, res) => {
  const { id } = req.params;

  try {
    const { rows: existingRows } = await pool.query('SELECT id FROM categories WHERE id = $1', [id]);
    if (!existingRows.length) {
      return res.status(404).json({ message: 'Category not found' });
    }

    await pool.query('UPDATE categories SET is_active = false, updated_at = NOW() WHERE id = $1', [id]);
    res.json({ message: 'Category deactivated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Unable to deactivate category', error: error.message });
  }
};

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};

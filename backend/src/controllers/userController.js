const bcrypt = require('bcrypt');
const pool = require('../config/db');

const listUsers = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, email, role, is_active, created_at FROM users');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch users', error: error.message });
  }
};

const createUser = async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'Name, email, password, and role are required' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password_hash, role, is_active, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id',
      [name, email, passwordHash, role, true]
    );
    res.status(201).json({ id: rows[0].id, name, email, role, is_active: true });
  } catch (error) {
    res.status(500).json({ message: 'Unable to create user', error: error.message });
  }
};

const updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, email, password, role, is_active } = req.body;

  try {
    const { rows: existingRows } = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (!existingRows.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    let passwordHash = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    const query = [];
    const params = [];

    if (name) { query.push(`name = $${params.length + 1}`); params.push(name); }
    if (email) { query.push(`email = $${params.length + 1}`); params.push(email); }
    if (role) { query.push(`role = $${params.length + 1}`); params.push(role); }
    if (typeof is_active === 'boolean') { query.push(`is_active = $${params.length + 1}`); params.push(is_active); }
    if (passwordHash) { query.push(`password_hash = $${params.length + 1}`); params.push(passwordHash); }

    if (!query.length) {
      return res.status(400).json({ message: 'No valid fields provided for update' });
    }

    const sql = `UPDATE users SET ${query.join(', ')} WHERE id = $${params.length + 1}`;
    params.push(id);

    await pool.query(sql, params);
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Unable to update user', error: error.message });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const { rows: existingRows } = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (!existingRows.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    await pool.query('UPDATE users SET is_active = false WHERE id = $1', [id]);
    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Unable to deactivate user', error: error.message });
  }
};

module.exports = {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
};

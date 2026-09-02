const pool = require('../config/db');

const listExpenses = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const { rows } = await pool.query(
      `SELECT e.id, e.title, e.category, e.amount, e.description, e.expense_date, e.user_id, u.name AS user_name, e.created_at, e.updated_at
       FROM expenses e
       LEFT JOIN users u ON e.user_id = u.id
       ORDER BY e.expense_date DESC LIMIT $1`,
      [limit]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch expenses', error: error.message });
  }
};

const createExpense = async (req, res) => {
  const { title, category, amount, description, expense_date } = req.body;
  if (!title || !category || amount === undefined || !expense_date) {
    return res.status(400).json({ message: 'Title, category, amount, and expense date are required' });
  }

  try {
    const { rows } = await pool.query(
      'INSERT INTO expenses (title, category, amount, description, user_id, expense_date, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING id',
      [title, category, amount, description || null, req.user.id, expense_date]
    );
    res.status(201).json({ id: rows[0].id, title, category, amount, description: description || null, expense_date });
  } catch (error) {
    res.status(500).json({ message: 'Unable to create expense', error: error.message });
  }
};

const updateExpense = async (req, res) => {
  const { id } = req.params;
  const { title, category, amount, description, expense_date } = req.body;

  try {
    const { rows: existingRows } = await pool.query('SELECT id FROM expenses WHERE id = $1', [id]);
    if (!existingRows.length) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    const query = [];
    const params = [];

    if (title) { query.push(`title = $${params.length + 1}`); params.push(title); }
    if (category) { query.push(`category = $${params.length + 1}`); params.push(category); }
    if (amount !== undefined) { query.push(`amount = $${params.length + 1}`); params.push(amount); }
    if (description !== undefined) { query.push(`description = $${params.length + 1}`); params.push(description); }
    if (expense_date) { query.push(`expense_date = $${params.length + 1}`); params.push(expense_date); }

    if (!query.length) {
      return res.status(400).json({ message: 'No valid fields provided for update' });
    }

    query.push('updated_at = NOW()');
    const sql = `UPDATE expenses SET ${query.join(', ')} WHERE id = $${params.length + 1}`;
    params.push(id);

    await pool.query(sql, params);
    res.json({ message: 'Expense updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Unable to update expense', error: error.message });
  }
};

const deleteExpense = async (req, res) => {
  const { id } = req.params;

  try {
    const { rows: existingRows } = await pool.query('SELECT id FROM expenses WHERE id = $1', [id]);
    if (!existingRows.length) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    await pool.query('DELETE FROM expenses WHERE id = $1', [id]);
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Unable to delete expense', error: error.message });
  }
};

module.exports = {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
};

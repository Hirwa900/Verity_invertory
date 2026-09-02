const express = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const { listExpenses, createExpense, updateExpense, deleteExpense } = require('../controllers/expenseController');

const router = express.Router();
router.use(authenticate);
router.get('/', authorize(['admin']), listExpenses);
router.post('/', authorize(['admin']), createExpense);
router.put('/:id', authorize(['admin']), updateExpense);
router.delete('/:id', authorize(['admin']), deleteExpense);

module.exports = router;

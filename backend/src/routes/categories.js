const express = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const { listCategories, createCategory, updateCategory, deleteCategory } = require('../controllers/categoryController');

const router = express.Router();
router.use(authenticate);
router.get('/', authorize(['admin', 'cashier']), listCategories);
router.post('/', authorize(['admin']), createCategory);
router.put('/:id', authorize(['admin']), updateCategory);
router.delete('/:id', authorize(['admin']), deleteCategory);

module.exports = router;

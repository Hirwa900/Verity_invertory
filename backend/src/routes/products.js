const express = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const { listProducts, getProduct, createProduct, updateProduct, deleteProduct } = require('../controllers/productController');

const router = express.Router();
router.use(authenticate);
router.get('/', authorize(['admin', 'cashier']), listProducts);
router.get('/:id', authorize(['admin', 'cashier']), getProduct);
router.post('/', authorize(['admin']), createProduct);
router.put('/:id', authorize(['admin']), updateProduct);
router.delete('/:id', authorize(['admin']), deleteProduct);

module.exports = router;

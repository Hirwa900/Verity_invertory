const express = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const { listSales, getSale, createSale } = require('../controllers/saleController');

const router = express.Router();
router.use(authenticate);
router.get('/', authorize(['admin', 'cashier']), listSales);
router.get('/:id', authorize(['admin', 'cashier']), getSale);
router.post('/', authorize(['admin', 'cashier']), createSale);

module.exports = router;

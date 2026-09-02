const express = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const { getStock, getStockMovements, adjustStock } = require('../controllers/stockController');

const router = express.Router();
router.use(authenticate);
router.get('/', authorize(['admin', 'cashier']), getStock);
router.get('/movements', authorize(['admin']), getStockMovements);
router.post('/adjustment', authorize(['admin']), adjustStock);

module.exports = router;

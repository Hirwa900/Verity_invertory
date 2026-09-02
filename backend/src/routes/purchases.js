const express = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const { listPurchases, getPurchase, createPurchase } = require('../controllers/purchaseController');

const router = express.Router();
router.use(authenticate);
router.get('/', authorize(['admin']), listPurchases);
router.get('/:id', authorize(['admin']), getPurchase);
router.post('/', authorize(['admin']), createPurchase);

module.exports = router;

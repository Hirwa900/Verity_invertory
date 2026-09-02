const express = require('express');
const { getDashboard } = require('../controllers/dashboardController');
const { authenticate } = require('../middlewares/auth');

const router = express.Router();
router.get('/', authenticate, getDashboard);

module.exports = router;

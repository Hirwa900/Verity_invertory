const express = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const { getDailyReport, getWeeklyReport, getMonthlyReport, getYearlyReport, getCustomReport } = require('../controllers/reportController');

const router = express.Router();
router.use(authenticate);
router.get('/daily', authorize(['admin']), getDailyReport);
router.get('/weekly', authorize(['admin']), getWeeklyReport);
router.get('/monthly', authorize(['admin']), getMonthlyReport);
router.get('/yearly', authorize(['admin']), getYearlyReport);
router.get('/custom', authorize(['admin']), getCustomReport);

module.exports = router;

const express = require('express');
const router = express.Router();
const { sendMail, sendReport } = require('../controllers/emailController');

router.post('/send', sendMail);
router.post('/report', sendReport);

module.exports = router;
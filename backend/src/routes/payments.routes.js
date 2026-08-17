const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { initiatePayment, verifyPayment } = require('../controllers/payments.controller');

const router = express.Router();

router.post('/initiate', authenticate, initiatePayment);
router.post('/verify', authenticate, verifyPayment);

module.exports = router;
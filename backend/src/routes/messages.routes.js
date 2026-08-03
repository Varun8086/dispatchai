const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { getOrderMessages } = require('../controllers/messages.controller');

const router = express.Router();

router.get('/:orderId', authenticate, getOrderMessages);

module.exports = router;
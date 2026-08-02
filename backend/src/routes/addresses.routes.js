const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { createAddress, listMyAddresses } = require('../controllers/addresses.controller');

const router = express.Router();

router.post('/', authenticate, createAddress);
router.get('/', authenticate, listMyAddresses);

module.exports = router;
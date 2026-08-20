const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { ask } = require('../controllers/assistant.controller');

const router = express.Router();

router.post('/ask', authenticate, ask);

module.exports = router;
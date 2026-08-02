const express = require('express');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { createOrder, listOrders, getOrderById, assignAgent, updateOrderStatus } = require('../controllers/orders.controller');


const router = express.Router();

router.post('/', authenticate, createOrder);
router.get('/', authenticate, listOrders);
router.get('/:id', authenticate, getOrderById);
router.patch('/:id/assign', authenticate, authorize('dispatcher', 'admin'), assignAgent);

router.patch('/:id/status', authenticate, updateOrderStatus);

module.exports = router;
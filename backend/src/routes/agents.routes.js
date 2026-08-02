const express = require('express');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {
  registerAgent,
  updateLocation,
  toggleAvailability,
  listNearbyAgents,
} = require('../controllers/agents.controller');

const router = express.Router();

router.post('/register', authenticate, registerAgent);
router.patch('/location', authenticate, updateLocation);
router.patch('/availability', authenticate, toggleAvailability);
router.get('/nearby', authenticate, authorize('dispatcher', 'admin'), listNearbyAgents);

module.exports = router;
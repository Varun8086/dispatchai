const pool = require('../db/pool');
const RazorpayProvider = require('../payments/providers/RazorpayProvider');

async function registerAgent(req, res, next) {
  try {
    const { vehicle_type, license_number } = req.body;
    const userId = req.user.userId;

    if (!vehicle_type || !license_number) {
      return res.status(400).json({ error: 'vehicle_type and license_number are required' });
    }

    // check user isn't already registered as an agent
    const existing = await pool.query('SELECT id FROM agents WHERE user_id = $1', [userId]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'This user is already registered as an agent' });
    }

    const result = await pool.query(
      `INSERT INTO agents (user_id, vehicle_type, license_number, is_available)
       VALUES ($1, $2, $3, true)
       RETURNING id, user_id, vehicle_type, license_number, is_available, created_at`,
      [userId, vehicle_type, license_number]
    );

    res.status(201).json({ agent: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function updateLocation(req, res, next) {
  try {
    const { latitude, longitude } = req.body;
    const userId = req.user.userId;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'latitude and longitude are required' });
    }

    const result = await pool.query(
      `UPDATE agents
       SET current_location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
           last_location_update = NOW(),
           updated_at = NOW()
       WHERE user_id = $3
       RETURNING id, ST_AsText(current_location) AS current_location, last_location_update`,
      [longitude, latitude, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent profile not found for this user' });
    }

    res.json({ agent: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function toggleAvailability(req, res, next) {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `UPDATE agents SET is_available = NOT is_available, updated_at = NOW()
       WHERE user_id = $1
       RETURNING id, is_available`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent profile not found for this user' });
    }

    res.json({ agent: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function listNearbyAgents(req, res, next) {
  try {
    const { latitude, longitude, radius_km } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'latitude and longitude query params are required' });
    }

    const radiusMeters = (radius_km || 5) * 1000;

    const result = await pool.query(
      `SELECT id, user_id, vehicle_type, is_available,
              ST_AsText(current_location) AS current_location,
              ST_Distance(current_location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_meters
       FROM agents
       WHERE is_available = true
         AND current_location IS NOT NULL
         AND ST_DWithin(current_location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
       ORDER BY distance_meters ASC`,
      [longitude, latitude, radiusMeters]
    );

    res.json({ agents: result.rows });
  } catch (err) {
    next(err);
  }
}

async function createPayoutAccount(req, res, next) {
  try {
    const userId = req.user.userId;

    const agentResult = await pool.query('SELECT id FROM agents WHERE user_id = $1', [userId]);
    if (agentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Agent profile not found' });
    }

    const userResult = await pool.query('SELECT name, email FROM users WHERE id = $1', [userId]);
    const { name, email } = userResult.rows[0];

    const razorpay = new RazorpayProvider();
    let linkedAccount;
    try {
      linkedAccount = await razorpay.createLinkedAccount({
        name,
        email,
        phone: '9999999999',
      });
    } catch (razorpayErr) {
      console.error('RAZORPAY ERROR:', JSON.stringify(razorpayErr, null, 2));
      throw razorpayErr;
    }

    await pool.query(
      `UPDATE agents SET razorpay_linked_account_id = $1 WHERE user_id = $2`,
      [linkedAccount.linkedAccountId, userId]
    );

    res.status(201).json({ linkedAccountId: linkedAccount.linkedAccountId });
  } catch (err) {
    next(err);
  }
}

module.exports = { registerAgent, updateLocation, toggleAvailability, listNearbyAgents, createPayoutAccount };
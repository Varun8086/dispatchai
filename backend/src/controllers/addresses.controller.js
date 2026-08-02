const pool = require('../db/pool');

async function createAddress(req, res, next) {
  try {
    const { label, full_address, latitude, longitude } = req.body;
    const userId = req.user.userId;

    if (!full_address || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'full_address, latitude, and longitude are required' });
    }

    const result = await pool.query(
      `INSERT INTO addresses (user_id, label, full_address, location)
       VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography)
       RETURNING id, label, full_address, ST_AsText(location) AS location, created_at`,
      [userId, label || null, full_address, longitude, latitude]
    );

    res.status(201).json({ address: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function listMyAddresses(req, res, next) {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT id, label, full_address, ST_AsText(location) AS location, created_at
       FROM addresses WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ addresses: result.rows });
  } catch (err) {
    next(err);
  }
}

module.exports = { createAddress, listMyAddresses };
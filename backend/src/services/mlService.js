const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

async function predictETA({ distanceKm, hourOfDay, dayOfWeek, vehicleType }) {
  try {
    const response = await axios.post(`${ML_SERVICE_URL}/predict-eta`, {
      distance_km: distanceKm,
      hour_of_day: hourOfDay,
      day_of_week: dayOfWeek,
      vehicle_type: vehicleType,
    });
    return response.data.eta_minutes;
  } catch (err) {
    console.error('ML service call failed:', err.message);
    return null; // fail gracefully — don't block order creation if ML service is down
  }
}

async function getSurgeMultiplier() {
  try {
    const response = await axios.get(`${ML_SERVICE_URL}/surge-multiplier`);
    return response.data.surge_multiplier;
  } catch (err) {
    console.error('Surge multiplier fetch failed:', err.message);
    return 1.0; // fail gracefully — default to no surge if ML service is unavailable
  }
}

module.exports = { predictETA, getSurgeMultiplier };

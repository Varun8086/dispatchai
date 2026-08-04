const kafka = require('../client');
const pool = require('../../db/pool');
const { publishEvent } = require('../producer');

const consumer = kafka.consumer({ groupId: 'location-persistence-service' });

const MAX_RETRIES = 3;

async function processMessage(event) {
  const { userId, orderId, latitude, longitude } = event;

  await pool.query(
    `UPDATE agents
     SET current_location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
         last_location_update = NOW()
     WHERE user_id = $3`,
    [longitude, latitude, userId]
  );

  await pool.query(
    `UPDATE orders
     SET current_location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
         updated_at = NOW()
     WHERE id = $3`,
    [longitude, latitude, orderId]
  );
}

async function startLocationUpdatesConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topic: 'location.updates', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const event = JSON.parse(message.value.toString());

      if (event.type !== 'agent.location_update') return;

      let attempt = 0;
      let succeeded = false;

      while (attempt < MAX_RETRIES && !succeeded) {
        try {
          await processMessage(event);
          succeeded = true;
          console.log(`[location-persistence-service] persisted location for user ${event.userId}, order ${event.orderId}`);
        } catch (err) {
          attempt++;
          console.error(`[location-persistence-service] attempt ${attempt} failed:`, err.message);
          if (attempt >= MAX_RETRIES) {
            console.error(`[location-persistence-service] max retries reached, sending to DLQ`);
            await publishEvent('location.updates.dlq', {
              originalEvent: event,
              error: err.message,
              failedAt: new Date().toISOString(),
            });
          }
        }
      }
    },
  });
}

module.exports = { startLocationUpdatesConsumer };
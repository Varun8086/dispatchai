require('dotenv').config();
const { startLocationUpdatesConsumer } = require('./locationUpdatesConsumer');

startLocationUpdatesConsumer()
  .then(() => console.log('Location persistence service running...'))
  .catch((err) => {
    console.error('Consumer failed to start:', err);
    process.exit(1);
  });
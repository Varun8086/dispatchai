require('dotenv').config();
const { startOrderEventsConsumer } = require('./orderEventsConsumer');

startOrderEventsConsumer()
  .then(() => console.log('Notification service consumer running...'))
  .catch((err) => {
    console.error('Consumer failed to start:', err);
    process.exit(1);
  });
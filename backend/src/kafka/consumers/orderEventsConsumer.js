const kafka = require('../client');

const consumer = kafka.consumer({ groupId: 'notification-service' });

async function startOrderEventsConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topic: 'order.events', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const event = JSON.parse(message.value.toString());

      console.log(`[notification-service] received event from partition ${partition}:`, event);

      switch (event.type) {
        case 'order.created':
          console.log(`  → Would notify customer ${event.customerId}: "Your order #${event.orderId} has been placed."`);
          break;
        case 'order.assigned':
          console.log(`  → Would notify customer: "An agent has been assigned to order #${event.orderId}."`);
          break;
        case 'order.status_changed':
          console.log(`  → Would notify customer: "Order #${event.orderId} is now ${event.newStatus}."`);
          break;
        default:
          console.log(`  → Unhandled event type: ${event.type}`);
      }
    },
  });
}

module.exports = { startOrderEventsConsumer };
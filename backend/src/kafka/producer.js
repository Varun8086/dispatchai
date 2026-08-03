const kafka = require('./client');

const producer = kafka.producer();
let isConnected = false;

async function connectProducer() {
  if (!isConnected) {
    await producer.connect();
    isConnected = true;
    console.log('Kafka producer connected');
  }
}

async function publishEvent(topic, event) {
  await connectProducer();
  await producer.send({
    topic,
    messages: [{ value: JSON.stringify(event) }],
  });
}

module.exports = { publishEvent };
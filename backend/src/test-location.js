const { io } = require('socket.io-client');

const AGENT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQsInJvbGUiOiJhZ2VudCIsImlhdCI6MTc4NTgwMTU1MCwiZXhwIjoxNzg1ODAyNDUwfQ.B3hMpym_e_GCQMOddmZAhd0sQTtJD3Qns_gQu7nXtsY';
const ORDER_ID = 1;

const agentSocket = io('http://localhost:4000', {
  auth: { token: AGENT_TOKEN },
});

agentSocket.on('connect', () => {
  console.log('[AGENT] connected:', agentSocket.id);
  agentSocket.emit('join-order', ORDER_ID);

  setTimeout(() => {
    console.log('[AGENT] sending location update...');
    agentSocket.emit('agent-location-update', {
      orderId: ORDER_ID,
      latitude: 28.6200,
      longitude: 77.2400,
    });

    setTimeout(() => {
      console.log('Done, closing.');
      agentSocket.close();
      process.exit(0);
    }, 2000);
  }, 1000);
});

agentSocket.on('connect_error', (err) => {
  console.error('[AGENT] connection error:', err.message);
});
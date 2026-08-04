const { Server } = require('socket.io');
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');
const jwt = require('jsonwebtoken');
const pool = require('./db/pool');
const { publishEvent } = require('./kafka/producer');

let io;

async function initSocket(httpServer) {
    io = new Server(httpServer, {
        cors: { origin: '*' }, // we'll lock this down properly once frontend exists
    });

    // Redis adapter setup — lets multiple server instances share socket events
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();
    await pubClient.connect();
    await subClient.connect();
    io.adapter(createAdapter(pubClient, subClient));

    // authenticate every socket connection using the same JWT from REST auth
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) {
            return next(new Error('Authentication required'));
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
            socket.user = decoded; // { userId, role }
            next();
        } catch (err) {
            next(new Error('Invalid or expired token'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`Socket connected: user ${socket.user.userId}, role ${socket.user.role}`);

        socket.on('join-order', (orderId) => {
            socket.join(`order:${orderId}`);
            console.log(`User ${socket.user.userId} joined room order:${orderId}`);
        });

        socket.on('agent-location-update', async ({ orderId, latitude, longitude }) => {
            try {
                // publish to Kafka instead of writing directly to Postgres
                await publishEvent('location.updates', {
                    type: 'agent.location_update',
                    userId: socket.user.userId,
                    orderId,
                    latitude,
                    longitude,
                    timestamp: new Date().toISOString(),
                });

                // still broadcast live to the room immediately — the socket doesn't need to wait for Kafka's consumer
                socket.to(`order:${orderId}`).emit('location-update', {
                    orderId,
                    latitude,
                    longitude,
                    timestamp: new Date().toISOString(),
                });
            } catch (err) {
                console.error('Failed to publish location update:', err.message);
            }
        });

        socket.on('send-message', async ({ orderId, content }) => {
            try {
                if (!content || !content.trim()) return;

                const result = await pool.query(
                    `INSERT INTO messages (order_id, sender_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, order_id, sender_id, content, created_at`,
                    [orderId, socket.user.userId, content.trim()]
                );

                const message = result.rows[0];

                // broadcast to EVERYONE in the room, including sender (so their own UI updates too)
                io.to(`order:${orderId}`).emit('new-message', message);
            } catch (err) {
                console.error('Failed to send message:', err.message);
            }
        });

        socket.on('disconnect', () => {
            console.log(`Socket disconnected: user ${socket.user.userId}`);
        });
    });



    return io;
}

function getIO() {
    if (!io) throw new Error('Socket.io not initialized yet');
    return io;
}

module.exports = { initSocket, getIO };
const { Server } = require('socket.io');
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');
const jwt = require('jsonwebtoken');
const pool = require('./db/pool');

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

        socket.on('leave-order', (orderId) => {
            socket.leave(`order:${orderId}`);
        });

        socket.on('agent-location-update', async ({ orderId, latitude, longitude }) => {
            try {
                // persist to the agent's own record
                await pool.query(
                    `UPDATE agents
       SET current_location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
           last_location_update = NOW()
       WHERE user_id = $3`,
                    [longitude, latitude, socket.user.userId]
                );

                // also persist to this specific order's current_location (order-in-progress snapshot)
                await pool.query(
                    `UPDATE orders
       SET current_location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
           updated_at = NOW()
       WHERE id = $3`,
                    [longitude, latitude, orderId]
                );

                // broadcast to everyone else watching this order
                socket.to(`order:${orderId}`).emit('location-update', {
                    orderId,
                    latitude,
                    longitude,
                    timestamp: new Date().toISOString(),
                });
            } catch (err) {
                console.error('Failed to persist location update:', err.message);
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
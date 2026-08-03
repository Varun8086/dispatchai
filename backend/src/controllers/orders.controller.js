const pool = require('../db/pool');
const { publishEvent } = require('../kafka/producer');

async function createOrder(req, res, next) {
  try {
    const { pickup_address_id, dropoff_address_id, fare_amount } = req.body;
    const customerId = req.user.userId;

    if (!pickup_address_id || !dropoff_address_id) {
      return res.status(400).json({ error: 'pickup_address_id and dropoff_address_id are required' });
    }

    // ownership check: make sure both addresses actually belong to this customer
    const addressCheck = await pool.query(
      `SELECT id FROM addresses WHERE id = ANY($1::int[]) AND user_id = $2`,
      [[pickup_address_id, dropoff_address_id], customerId]
    );

    if (addressCheck.rows.length !== 2) {
      return res.status(403).json({ error: 'One or both addresses do not belong to you' });
    }

    const result = await pool.query(
      `INSERT INTO orders (customer_id, pickup_address_id, dropoff_address_id, fare_amount, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id, customer_id, pickup_address_id, dropoff_address_id, status, fare_amount, created_at`,
      [customerId, pickup_address_id, dropoff_address_id, fare_amount || null]
    );

    await publishEvent('order.events', {
      type: 'order.created',
      orderId: result.rows[0].id,
      customerId: customerId,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({ order: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function listOrders(req, res, next) {
  try {
    const { userId, role } = req.user;

    let query, params;

    if (role === 'dispatcher' || role === 'admin') {
      // dispatchers/admins see ALL orders
      query = `SELECT * FROM orders ORDER BY created_at DESC`;
      params = [];
    } else if (role === 'agent') {
      // agents see only orders assigned to them
      query = `
        SELECT o.* FROM orders o
        JOIN agents a ON o.agent_id = a.id
        WHERE a.user_id = $1
        ORDER BY o.created_at DESC`;
      params = [userId];
    } else {
      // customers see only their own orders
      query = `SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC`;
      params = [userId];
    }

    const result = await pool.query(query, params);
    res.json({ orders: result.rows });
  } catch (err) {
    next(err);
  }
}

async function getOrderById(req, res, next) {
  try {
    const { id } = req.params;
    const { userId, role } = req.user;

    const result = await pool.query(`SELECT * FROM orders WHERE id = $1`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = result.rows[0];

    // ownership check: customers can only view their own orders
    const isPrivileged = role === 'dispatcher' || role === 'admin';
    const isOwner = order.customer_id === userId;

    if (!isPrivileged && !isOwner) {
      return res.status(403).json({ error: 'You do not have access to this order' });
    }

    res.json({ order });
  } catch (err) {
    next(err);
  }
}

async function assignAgent(req, res, next) {
  try {
    const { id } = req.params;
    const { agent_id } = req.body;

    if (!agent_id) {
      return res.status(400).json({ error: 'agent_id is required' });
    }

    const result = await pool.query(
      `UPDATE orders SET agent_id = $1, status = 'assigned', updated_at = NOW()
       WHERE id = $2 AND status = 'pending'
       RETURNING *`,
      [agent_id, id]
    );

    await publishEvent('order.events', {
      type: 'order.assigned',
      orderId: result.rows[0].id,
      agentId: agent_id,
      timestamp: new Date().toISOString(),
    });

    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'Order not found or not in a pending state' });
    }

    res.json({ order: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

const VALID_TRANSITIONS = {
  assigned: ['picked_up', 'cancelled'],
  picked_up: ['in_transit', 'cancelled'],
  in_transit: ['delivered'],
};

async function updateOrderStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status: newStatus } = req.body;
    const userId = req.user.userId;

    if (!newStatus) {
      return res.status(400).json({ error: 'status is required' });
    }

    // confirm this order belongs to the agent making the request
    const orderResult = await pool.query(
      `SELECT o.* FROM orders o
       JOIN agents a ON o.agent_id = a.id
       WHERE o.id = $1 AND a.user_id = $2`,
      [id, userId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(403).json({ error: 'You are not assigned to this order' });
    }

    const currentStatus = orderResult.rows[0].status;
    const allowedNext = VALID_TRANSITIONS[currentStatus] || [];

    if (!allowedNext.includes(newStatus)) {
      return res.status(400).json({
        error: `Cannot transition from '${currentStatus}' to '${newStatus}'`,
      });
    }

    const result = await pool.query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [newStatus, id]
    );

    await publishEvent('order.events', {
      type: 'order.status_changed',
      orderId: result.rows[0].id,
      newStatus: newStatus,
      timestamp: new Date().toISOString(),
    });

    res.json({ order: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { createOrder, listOrders, getOrderById, assignAgent, updateOrderStatus };

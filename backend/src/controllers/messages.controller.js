const pool = require('../db/pool');

async function getOrderMessages(req, res, next) {
  try {
    const { orderId } = req.params;
    const { userId, role } = req.user;

    // ownership check: only the order's customer, assigned agent, or dispatcher/admin can view
    const orderCheck = await pool.query(
      `SELECT o.customer_id, a.user_id AS agent_user_id
       FROM orders o
       LEFT JOIN agents a ON o.agent_id = a.id
       WHERE o.id = $1`,
      [orderId]
    );

    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const { customer_id, agent_user_id } = orderCheck.rows[0];
    const isPrivileged = role === 'dispatcher' || role === 'admin';
    const isParticipant = userId === customer_id || userId === agent_user_id;

    if (!isPrivileged && !isParticipant) {
      return res.status(403).json({ error: 'You do not have access to this conversation' });
    }

    const result = await pool.query(
      `SELECT id, order_id, sender_id, content, created_at
       FROM messages WHERE order_id = $1 ORDER BY created_at ASC`,
      [orderId]
    );

    res.json({ messages: result.rows });
  } catch (err) {
    next(err);
  }
}

module.exports = { getOrderMessages };
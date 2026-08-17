const pool = require('../db/pool');
const { getPaymentProvider } = require('../payments/paymentProviderFactory');
const { publishEvent } = require('../kafka/producer');

async function initiatePayment(req, res, next) {
  try {
    const { orderId, provider, currency } = req.body;
    const userId = req.user.userId;

    if (!orderId || !provider) {
      return res.status(400).json({ error: 'orderId and provider are required' });
    }

    // confirm the order exists, belongs to this customer, and get the fare
    const orderResult = await pool.query(
      `SELECT id, customer_id, fare_amount FROM orders WHERE id = $1`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];
    if (order.customer_id !== userId) {
      return res.status(403).json({ error: 'You do not own this order' });
    }

    if (!order.fare_amount) {
      return res.status(400).json({ error: 'Order has no fare amount set' });
    }

    const paymentProvider = getPaymentProvider(provider);
    const result = await paymentProvider.createPayment({
      amount: parseFloat(order.fare_amount),
      currency: currency || (provider === 'razorpay' ? 'INR' : 'USD'),
      orderId: order.id,
    });

    const dbResult = await pool.query(
      `INSERT INTO payments (order_id, provider, provider_order_id, amount, currency, status)
       VALUES ($1, $2, $3, $4, $5, 'created')
       RETURNING *`,
      [order.id, provider, result.providerOrderId, result.amount, result.currency]
    );

    await publishEvent('payment.events', {
      type: 'payment.initiated',
      paymentId: dbResult.rows[0].id,
      orderId: order.id,
      provider,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({
      payment: dbResult.rows[0],
      providerData: result.raw, // frontend needs this to render the actual checkout widget
    });
  } catch (err) {
    next(err);
  }
}

async function verifyPayment(req, res, next) {
  try {
    const { paymentId, providerPaymentId, signature } = req.body;

    if (!paymentId) {
      return res.status(400).json({ error: 'paymentId is required' });
    }

    const paymentResult = await pool.query('SELECT * FROM payments WHERE id = $1', [paymentId]);
    if (paymentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = paymentResult.rows[0];
    const paymentProvider = getPaymentProvider(payment.provider);

    const verification = await paymentProvider.verifyPayment({
      providerOrderId: payment.provider_order_id,
      providerPaymentId,
      signature,
    });

    const newStatus = verification.verified ? 'succeeded' : 'failed';

    const updated = await pool.query(
      `UPDATE payments SET status = $1, provider_payment_id = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [newStatus, providerPaymentId || null, paymentId]
    );

    await publishEvent('payment.events', {
      type: verification.verified ? 'payment.succeeded' : 'payment.failed',
      paymentId: payment.id,
      orderId: payment.order_id,
      provider: payment.provider,
      timestamp: new Date().toISOString(),
    });

    res.json({ payment: updated.rows[0], verified: verification.verified });
  } catch (err) {
    next(err);
  }
}

module.exports = { initiatePayment, verifyPayment };
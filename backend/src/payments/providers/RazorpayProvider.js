const Razorpay = require('razorpay');
const crypto = require('crypto');
const PaymentProvider = require('../PaymentProvider');

class RazorpayProvider extends PaymentProvider {
  constructor() {
    super();
    this.client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }

  async createPayment({ amount, currency, orderId }) {
    const razorpayOrder = await this.client.orders.create({
      amount: Math.round(amount * 100),
      currency: currency || 'INR',
      receipt: `order_${orderId}`,
    });

    return {
      provider: 'razorpay',
      providerOrderId: razorpayOrder.id,
      amount: amount, // return the original rupee amount, not razorpayOrder.amount (paise)
      currency: razorpayOrder.currency,
      raw: razorpayOrder,
    };
  }

  async verifyPayment({ providerOrderId, providerPaymentId, signature }) {
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${providerOrderId}|${providerPaymentId}`)
      .digest('hex');

    const isValid = generatedSignature === signature;
    return { verified: isValid };
  }
}

module.exports = RazorpayProvider;
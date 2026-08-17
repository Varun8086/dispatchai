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

  async refundPayment({ providerPaymentId, amount }) {
    const refund = await this.client.payments.refund(providerPaymentId, {
      amount: Math.round(amount * 100), // paise, same unit conversion rule as createPayment
    });

    return {
      provider: 'razorpay',
      refundId: refund.id,
      status: refund.status,
      raw: refund,
    };
  }

  async createLinkedAccount({ name, email, phone, ifscCode, accountNumber, businessName }) {
    const account = await this.client.accounts.create({
      email,
      phone,
      type: 'route',
      reference_id: `agent_${email}`,
      legal_business_name: businessName || name,
      business_type: 'individual',
      contact_name: name,
      profile: {
        category: 'transport',
        subcategory: 'logistics',
        addresses: {
          registered: {
            street1: 'NA', street2: 'NA', city: 'NA', state: 'NA', postal_code: '000000', country: 'IN',
          },
        },
      },
      legal_info: {
        pan: 'AAACL1234C', // placeholder for test mode
      },
    });

    return { linkedAccountId: account.id, raw: account };
  }

  async transferFunds({ paymentId, linkedAccountId, amount }) {
    const transfer = await this.client.payments.transfer(paymentId, {
      transfers: [
        {
          account: linkedAccountId,
          amount: Math.round(amount * 100),
          currency: 'INR',
        },
      ],
    });

    return { transferId: transfer.items?.[0]?.id, raw: transfer };
  }

}

module.exports = RazorpayProvider;
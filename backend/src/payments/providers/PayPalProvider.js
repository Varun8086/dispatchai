const paypal = require('@paypal/checkout-server-sdk');
const PaymentProvider = require('../PaymentProvider');

function paypalClient() {
  const environment = new paypal.core.SandboxEnvironment(
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_CLIENT_SECRET
  );
  return new paypal.core.PayPalHttpClient(environment);
}

class PayPalProvider extends PaymentProvider {
  constructor() {
    super();
    this.client = paypalClient();
  }

  async createPayment({ amount, currency, orderId }) {
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: `order_${orderId}`,
          amount: {
            currency_code: currency || 'USD',
            value: amount.toFixed(2),
          },
        },
      ],
    });

    const response = await this.client.execute(request);

    return {
      provider: 'paypal',
      providerOrderId: response.result.id,
      amount: response.result.purchase_units[0].amount.value,
      currency: response.result.purchase_units[0].amount.currency_code,
      raw: response.result,
    };
  }

  async verifyPayment({ providerOrderId }) {
    const request = new paypal.orders.OrdersGetRequest(providerOrderId);
    const response = await this.client.execute(request);

    const isValid = response.result.status === 'COMPLETED';
    return { verified: isValid, status: response.result.status };
  }
}

module.exports = PayPalProvider;
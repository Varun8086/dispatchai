class PaymentProvider {
  async createPayment({ amount, currency, orderId }) {
    throw new Error('createPayment() must be implemented by the provider');
  }

  async verifyPayment(payload) {
    throw new Error('verifyPayment() must be implemented by the provider');
  }

  async refundPayment({ providerPaymentId, amount }) {
    throw new Error('refundPayment() must be implemented by the provider');
  }
  
}

module.exports = PaymentProvider;
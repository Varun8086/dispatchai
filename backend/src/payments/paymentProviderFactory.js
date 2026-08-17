const RazorpayProvider = require('./providers/RazorpayProvider');
const PayPalProvider = require('./providers/PayPalProvider');

function getPaymentProvider(providerName) {
  switch (providerName) {
    case 'razorpay':
      return new RazorpayProvider();
    case 'paypal':
      return new PayPalProvider();
    default:
      throw new Error(`Unsupported payment provider: ${providerName}`);
  }
}

module.exports = { getPaymentProvider };
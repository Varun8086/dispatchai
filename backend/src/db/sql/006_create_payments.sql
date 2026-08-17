CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('razorpay', 'paypal')),
  provider_order_id VARCHAR(255) NOT NULL,
  provider_payment_id VARCHAR(255),
  amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'succeeded', 'failed', 'refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_order_id ON payments(order_id);
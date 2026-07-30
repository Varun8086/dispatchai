CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
  pickup_address_id INTEGER NOT NULL REFERENCES addresses(id) ON DELETE RESTRICT,
  dropoff_address_id INTEGER NOT NULL REFERENCES addresses(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled')),
  fare_amount NUMERIC(10, 2),
  current_location GEOGRAPHY(Point, 4326),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
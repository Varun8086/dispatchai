CREATE TABLE agents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_type VARCHAR(30) NOT NULL CHECK (vehicle_type IN ('bike', 'scooter', 'car', 'van')),
  license_number VARCHAR(50) NOT NULL UNIQUE,
  is_available BOOLEAN NOT NULL DEFAULT true,
  current_location GEOGRAPHY(Point, 4326),
  last_location_update TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
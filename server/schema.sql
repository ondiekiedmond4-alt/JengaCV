-- JengaCV database schema
-- Run this once against your Postgres database before first use.
-- On Render: Dashboard -> your Postgres -> Connect -> psql, then paste this file's contents,
-- or run: psql "$DATABASE_URL" -f schema.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anon_id VARCHAR(64) UNIQUE,             -- legacy: pre-accounts anonymous ID, kept for old rows
  email VARCHAR(255) UNIQUE,
  password_hash TEXT,
  name VARCHAR(255),
  phone VARCHAR(20),
  marketing_opt_in BOOLEAN NOT NULL DEFAULT false,
  downloads_remaining INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Migration for databases created before real accounts existed: adds the
-- new columns and relaxes anon_id to optional. Safe to re-run.
ALTER TABLE users ALTER COLUMN anon_id DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN NOT NULL DEFAULT false;

-- Password reset tokens. We store only a hash of the token (never the raw
-- value) so a database leak alone can't be used to reset anyone's password.
CREATE TABLE IF NOT EXISTS password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash ON password_resets(token_hash);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL,               -- 'mpesa' | 'card'
  checkout_request_id VARCHAR(100) UNIQUE,      -- Daraja CheckoutRequestID, or card provider's txn ref
  merchant_request_id VARCHAR(100),
  amount DECIMAL(10,2) NOT NULL DEFAULT 500.00,
  phone_number VARCHAR(20),
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | success | failed
  credits_granted INT DEFAULT 0,
  result_code INT,
  result_desc TEXT,
  raw_callback JSONB,
  created_at TIMESTAMP DEFAULT now(),
  confirmed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id),
  downloaded_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_checkout ON payments(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_users_anon_id ON users(anon_id);

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
  referral_code VARCHAR(12) UNIQUE,       -- this user's own shareable code
  referred_by UUID REFERENCES users(id),  -- whose referral code they signed up with, if any
  referral_rewarded BOOLEAN NOT NULL DEFAULT false, -- has the referrer already been paid for THIS user's first purchase?
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
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(12) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_rewarded BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Email verification tokens — same hash-only pattern as password resets.
CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_verifications_token_hash ON email_verifications(token_hash);

-- Autosaved CV content. One row per user, upserted as they edit — this is
-- what makes "come back later and keep editing" possible, and also what
-- gets emailed / read by the AI proofreader.
CREATE TABLE IF NOT EXISTS cvs (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  content JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT now()
);

-- Optional, anonymous-to-Eddie salary expectation data, collected right
-- before download so it doesn't slow anyone down mid-edit. Declining is
-- always available — this is purely for aggregate market insight.
CREATE TABLE IF NOT EXISTS salary_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role_title VARCHAR(255),
  salary_range VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

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

-- One row per referral reward earned. Payouts are handled manually for
-- now (see server/scripts/pay-referrals.js) rather than automated M-Pesa
-- disbursement, which needs a separate Safaricom B2C API approval this
-- app doesn't have yet.
CREATE TABLE IF NOT EXISTS referral_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reward_amount_kes DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'earned', -- earned | paid_out
  paid_out_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referral_earnings_referrer ON referral_earnings(referrer_id);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);


CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL,               -- 'mpesa' | 'card' | 'flutterwave'
  checkout_request_id VARCHAR(100) UNIQUE,      -- Daraja CheckoutRequestID, or card provider's txn ref
  merchant_request_id VARCHAR(100),
  amount DECIMAL(10,2) NOT NULL DEFAULT 500.00, -- canonical KES 500 base price, always
  currency VARCHAR(3) NOT NULL DEFAULT 'KES',   -- what was actually charged (e.g. TZS, UGX, USD)
  charged_amount DECIMAL(12,2),                 -- amount in `currency`, after conversion
  phone_number VARCHAR(20),
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | success | failed
  credits_granted INT DEFAULT 0,
  result_code INT,
  result_desc TEXT,
  raw_callback JSONB,
  created_at TIMESTAMP DEFAULT now(),
  confirmed_at TIMESTAMP
);

-- Migration for databases created before location-based currency conversion
-- existed. Safe to re-run.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'KES';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS charged_amount DECIMAL(12,2);

CREATE TABLE IF NOT EXISTS downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id),
  downloaded_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_checkout ON payments(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_users_anon_id ON users(anon_id);

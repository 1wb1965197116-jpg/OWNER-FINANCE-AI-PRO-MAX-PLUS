-- OWNER FINANCE AI PRO MAX PLUS
-- Migration 001: secure account and encrypted workspace storage foundation.
-- Apply only after a PostgreSQL instance is provisioned and backed up.
-- The application must connect using a non-owner role that does NOT have BYPASSRLS.

BEGIN;

CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  display_name text,
  account_status text NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active','locked','disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_lower_uq ON app_users (lower(email));

CREATE TABLE IF NOT EXISTS app_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash bytea NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  user_agent_hash bytea,
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS app_sessions_user_expiry_idx ON app_sessions(user_id, expires_at);
CREATE INDEX IF NOT EXISTS app_sessions_expiry_idx ON app_sessions(expires_at) WHERE revoked_at IS NULL;

-- All user workspace content is encrypted by the application before it reaches PostgreSQL.
-- Do not place names, addresses, phone numbers, document text, or financial details in metadata.
CREATE TABLE IF NOT EXISTS workspace_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  record_type text NOT NULL CHECK (record_type IN (
    'deal','seller_lead','seller_interaction','buyer_offer','contract',
    'diligence','closing_milestone','portfolio','investment_profile',
    'autopilot_plan','user_setting'
  )),
  client_record_id text NOT NULL,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  encryption_key_version integer NOT NULL CHECK (encryption_key_version > 0),
  encryption_algorithm text NOT NULL DEFAULT 'AES-256-GCM'
    CHECK (encryption_algorithm = 'AES-256-GCM'),
  nonce bytea NOT NULL,
  auth_tag bytea NOT NULL,
  ciphertext bytea NOT NULL,
  safe_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, record_type, client_record_id),
  CHECK (octet_length(nonce) = 12),
  CHECK (octet_length(auth_tag) = 16),
  CHECK (octet_length(ciphertext) > 0),
  CHECK (jsonb_typeof(safe_metadata) = 'object')
);
CREATE INDEX IF NOT EXISTS workspace_records_user_type_updated_idx
  ON workspace_records(user_id, record_type, updated_at DESC);
CREATE INDEX IF NOT EXISTS workspace_records_user_updated_idx
  ON workspace_records(user_id, updated_at DESC);

-- Append-only security and approval trail. Store identifiers and event types only,
-- never passwords, session tokens, API keys, signatures, or full contract contents.
CREATE TABLE IF NOT EXISTS audit_events (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'login_succeeded','login_failed','logout','record_created','record_updated',
    'record_deleted','backup_exported','backup_restored','offer_approved',
    'contract_approved','signature_applied','integration_connected',
    'integration_disconnected'
  )),
  record_type text,
  record_id text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  request_id text
);
CREATE INDEX IF NOT EXISTS audit_events_user_time_idx ON audit_events(user_id, occurred_at DESC);

-- Row-level security is defense in depth. The server must set app.user_id
-- transaction-locally after authenticating the session for EVERY data transaction.
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users FORCE ROW LEVEL SECURITY;
ALTER TABLE app_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE workspace_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_records FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_users_self ON app_users;
CREATE POLICY app_users_self ON app_users
  USING (id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (id = NULLIF(current_setting('app.user_id', true), '')::uuid);

DROP POLICY IF EXISTS app_sessions_self ON app_sessions;
CREATE POLICY app_sessions_self ON app_sessions
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

DROP POLICY IF EXISTS workspace_records_self ON workspace_records;
CREATE POLICY workspace_records_self ON workspace_records
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

DROP POLICY IF EXISTS audit_events_self ON audit_events;
CREATE POLICY audit_events_self ON audit_events
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

COMMIT;

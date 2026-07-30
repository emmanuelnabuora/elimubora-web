-- ============================================================
-- 0001_foundation.sql
-- ElimuBora foundation schema: multi-tenancy, audit, outbox.
-- Runs as the database owner via tools/migrate.mjs.
-- Runtime connections use elimubora_app (RLS enforced, tenant-scoped)
-- or elimubora_worker (background jobs; granted explicit cross-tenant
-- policies rather than BYPASSRLS, which is not grantable on managed
-- Postgres such as AWS RDS).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE SCHEMA IF NOT EXISTS core;

-- ------------------------------------------------------------
-- Roles (idempotent). Passwords are placeholders for local dev;
-- production credentials come from the secrets manager and are
-- rotated via ALTER ROLE outside of migrations.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'elimubora_app') THEN
    CREATE ROLE elimubora_app LOGIN PASSWORD 'app_dev_password';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'elimubora_worker') THEN
    CREATE ROLE elimubora_worker LOGIN PASSWORD 'worker_dev_password';
  END IF;
END $$;

GRANT USAGE ON SCHEMA core TO elimubora_app, elimubora_worker;

-- ------------------------------------------------------------
-- Shared helper functions
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- Tenant id for the current transaction, set by the API layer via
-- SELECT set_config('app.tenant_id', $1, true). NULL when unset.
CREATE OR REPLACE FUNCTION core.current_tenant_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

-- Actor id (user/service) for audit attribution.
CREATE OR REPLACE FUNCTION core.current_actor_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.actor_id', true), '')::uuid
$$;

-- ------------------------------------------------------------
-- Tenants (global table — no RLS; access mediated by the API)
-- kind reflects Kenya's institutional landscape.
-- ------------------------------------------------------------
CREATE TABLE core.tenants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         citext NOT NULL UNIQUE,
  name         text NOT NULL,
  kind         text NOT NULL
               CHECK (kind IN ('school','county','university','tvet','ministry','partner')),
  county_code  text,                       -- ISO / IEBC county code, e.g. '047' Nairobi
  nemis_code   text UNIQUE,                -- NEMIS institution code when applicable
  status       text NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','suspended','archived')),
  settings     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz                  -- soft delete
);

CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON core.tenants
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

CREATE INDEX idx_tenants_kind   ON core.tenants (kind) WHERE deleted_at IS NULL;
CREATE INDEX idx_tenants_county ON core.tenants (county_code) WHERE deleted_at IS NULL;

GRANT SELECT ON core.tenants TO elimubora_app, elimubora_worker;
GRANT INSERT, UPDATE ON core.tenants TO elimubora_app;

-- ------------------------------------------------------------
-- Audit log — append-only, tenant-isolated via RLS.
-- Data Protection Act 2019: immutable record of processing.
-- ------------------------------------------------------------
CREATE TABLE core.audit_log (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id    uuid REFERENCES core.tenants(id),
  actor_id     uuid,
  actor_type   text NOT NULL DEFAULT 'user'
               CHECK (actor_type IN ('user','service','system')),
  action       text NOT NULL,              -- e.g. 'tenant.updated'
  entity_type  text NOT NULL,              -- e.g. 'tenant'
  entity_id    text,
  before       jsonb,
  after        jsonb,
  ip           inet,
  user_agent   text,
  request_id   text,
  occurred_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_tenant_time ON core.audit_log (tenant_id, occurred_at DESC);
CREATE INDEX idx_audit_entity      ON core.audit_log (entity_type, entity_id);

ALTER TABLE core.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.audit_log FORCE ROW LEVEL SECURITY;

CREATE POLICY audit_tenant_isolation ON core.audit_log
  TO elimubora_app
  USING (tenant_id = core.current_tenant_id())
  WITH CHECK (tenant_id = core.current_tenant_id());

-- Background jobs may read audit entries across tenants (e.g. NEMIS
-- sync reconciliation) but never write them.
CREATE POLICY audit_worker_read ON core.audit_log
  FOR SELECT TO elimubora_worker USING (true);

-- Append-only for the app role: no UPDATE or DELETE grants, ever.
GRANT SELECT, INSERT ON core.audit_log TO elimubora_app;
GRANT SELECT ON core.audit_log TO elimubora_worker;

-- ------------------------------------------------------------
-- Transactional outbox — domain events written in the same
-- transaction as the state change, relayed asynchronously.
-- ------------------------------------------------------------
CREATE TABLE core.outbox (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id       uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  tenant_id      uuid,
  aggregate_type text NOT NULL,            -- e.g. 'tenant'
  aggregate_id   text NOT NULL,
  event_type     text NOT NULL,            -- e.g. 'tenant.created.v1'
  payload        jsonb NOT NULL,
  occurred_at    timestamptz NOT NULL DEFAULT now(),
  published_at   timestamptz,
  attempts       int NOT NULL DEFAULT 0,
  last_error     text
);

CREATE INDEX idx_outbox_unpublished ON core.outbox (id) WHERE published_at IS NULL;
CREATE INDEX idx_outbox_tenant      ON core.outbox (tenant_id, occurred_at DESC);

ALTER TABLE core.outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.outbox FORCE ROW LEVEL SECURITY;

CREATE POLICY outbox_tenant_isolation ON core.outbox
  TO elimubora_app
  USING (tenant_id = core.current_tenant_id())
  WITH CHECK (tenant_id = core.current_tenant_id());

-- The relay reads and marks events across all tenants.
CREATE POLICY outbox_worker_all ON core.outbox
  TO elimubora_worker USING (true) WITH CHECK (true);

GRANT SELECT, INSERT ON core.outbox TO elimubora_app;
-- The relay (worker role) reads across tenants and marks published.
GRANT SELECT, UPDATE (published_at, attempts, last_error) ON core.outbox TO elimubora_worker;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA core TO elimubora_app, elimubora_worker;

-- ============================================================
-- 0002_identity.sql
-- Global user identity + tenant memberships + refresh tokens.
--
-- Identity is GLOBAL: one account per person for life (teachers
-- transfer between schools; county officers span tenants). Access
-- is granted per-tenant through core.memberships, which carries
-- the role used for RBAC.
-- ============================================================

-- ------------------------------------------------------------
-- Users (global — intentionally NOT under RLS: authentication
-- must look users up before any tenant/actor context exists.
-- PII exposure is bounded at the repository layer; Sprint 3
-- adds a SECURITY DEFINER lookup function to tighten this.)
-- ------------------------------------------------------------
CREATE TABLE core.users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           citext NOT NULL UNIQUE,
  phone           text,
  full_name       text NOT NULL,
  password_hash   text NOT NULL,
  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','suspended')),
  failed_attempts int NOT NULL DEFAULT 0,
  locked_until    timestamptz,
  totp_secret_enc text,
  totp_enabled    boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON core.users
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

GRANT SELECT, INSERT, UPDATE ON core.users TO elimubora_app;
GRANT SELECT ON core.users TO elimubora_worker;

-- ------------------------------------------------------------
-- Memberships: user ↔ tenant with role. RLS lets the app role
-- see (a) rows of the current tenant, or (b) the caller's own
-- rows across tenants (needed at login to list institutions).
-- ------------------------------------------------------------
CREATE TABLE core.memberships (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES core.users(id),
  tenant_id   uuid NOT NULL REFERENCES core.tenants(id),
  role        text NOT NULL CHECK (role IN (
                'learner','teacher','parent','school_admin','principal',
                'county_officer','ministry_official','platform_admin')),
  status      text NOT NULL DEFAULT 'active'
              CHECK (status IN ('active','suspended')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  UNIQUE (user_id, tenant_id, role)
);

CREATE TRIGGER trg_memberships_updated_at
  BEFORE UPDATE ON core.memberships
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

CREATE INDEX idx_memberships_tenant ON core.memberships (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_memberships_user   ON core.memberships (user_id)   WHERE deleted_at IS NULL;

ALTER TABLE core.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.memberships FORCE ROW LEVEL SECURITY;

CREATE POLICY memberships_tenant ON core.memberships
  TO elimubora_app
  USING (tenant_id = core.current_tenant_id())
  WITH CHECK (tenant_id = core.current_tenant_id());

CREATE POLICY memberships_self ON core.memberships
  FOR SELECT TO elimubora_app
  USING (user_id = core.current_actor_id());

CREATE POLICY memberships_worker_read ON core.memberships
  FOR SELECT TO elimubora_worker USING (true);

GRANT SELECT, INSERT, UPDATE ON core.memberships TO elimubora_app;
GRANT SELECT ON core.memberships TO elimubora_worker;

-- ------------------------------------------------------------
-- Refresh tokens: opaque values stored as SHA-256 hashes only.
-- family_id groups rotations of one login session; reuse of a
-- rotated token revokes the entire family (theft response).
-- ------------------------------------------------------------
CREATE TABLE core.refresh_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id    uuid NOT NULL,
  user_id      uuid NOT NULL REFERENCES core.users(id),
  tenant_id    uuid NOT NULL REFERENCES core.tenants(id),
  role         text NOT NULL,
  token_hash   text NOT NULL UNIQUE,
  expires_at   timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  revoked_at   timestamptz,
  replaced_by  uuid,
  ip           inet,
  user_agent   text
);

CREATE INDEX idx_refresh_family ON core.refresh_tokens (family_id);
CREATE INDEX idx_refresh_user   ON core.refresh_tokens (user_id) WHERE revoked_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON core.refresh_tokens TO elimubora_app;

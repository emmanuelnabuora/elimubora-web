-- ============================================================
-- 0003_user_management.sql
-- 1) Close the Sprint 2 soft spot: core.users goes under FORCE
--    RLS. Pre-authentication lookups (login, MFA, password reset)
--    move into SECURITY DEFINER functions owned by a dedicated
--    non-login role, so the app role can authenticate users it
--    cannot otherwise read.
-- 2) Invitation-based onboarding and password resets.
-- ============================================================

-- ------------------------------------------------------------
-- Definer role: owns the narrow auth functions, nothing else.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'elimubora_auth') THEN
    CREATE ROLE elimubora_auth NOLOGIN;
  END IF;
  -- Migration owner must be a member to transfer function ownership.
  EXECUTE format('GRANT elimubora_auth TO %I', current_user);
END $$;

-- USAGE for execution; CREATE because ALTER FUNCTION ... OWNER requires
-- the new owner to hold CREATE on the schema.
GRANT USAGE, CREATE ON SCHEMA core TO elimubora_auth;
GRANT SELECT, UPDATE ON core.users TO elimubora_auth;

-- ------------------------------------------------------------
-- RLS on core.users
-- ------------------------------------------------------------
ALTER TABLE core.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.users FORCE ROW LEVEL SECURITY;

-- A user sees and updates their own row.
CREATE POLICY users_self ON core.users
  TO elimubora_app
  USING (id = core.current_actor_id())
  WITH CHECK (id = core.current_actor_id());

-- Members of the current tenant are visible (admin listings).
CREATE POLICY users_tenant_members ON core.users
  FOR SELECT TO elimubora_app
  USING (EXISTS (
    SELECT 1 FROM core.memberships m
     WHERE m.user_id = users.id
       AND m.tenant_id = core.current_tenant_id()
       AND m.deleted_at IS NULL));

-- Creation is app-mediated (invitation accept / dev registration).
CREATE POLICY users_app_insert ON core.users
  FOR INSERT TO elimubora_app WITH CHECK (true);

CREATE POLICY users_worker_read ON core.users
  FOR SELECT TO elimubora_worker USING (true);

CREATE POLICY users_auth_all ON core.users
  TO elimubora_auth USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- SECURITY DEFINER auth functions (fixed search_path; EXECUTE
-- granted to the app role only).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.auth_lookup_user_by_email(p_email citext)
RETURNS TABLE (id uuid, email citext, full_name text, password_hash text,
               status text, failed_attempts int, locked_until timestamptz,
               totp_secret_enc text, totp_enabled boolean)
LANGUAGE sql SECURITY DEFINER SET search_path = core, pg_temp AS $$
  SELECT u.id, u.email, u.full_name, u.password_hash, u.status,
         u.failed_attempts, u.locked_until, u.totp_secret_enc, u.totp_enabled
    FROM core.users u
   WHERE u.email = p_email AND u.deleted_at IS NULL
$$;

CREATE OR REPLACE FUNCTION core.auth_lookup_user_by_id(p_id uuid)
RETURNS TABLE (id uuid, email citext, full_name text, password_hash text,
               status text, failed_attempts int, locked_until timestamptz,
               totp_secret_enc text, totp_enabled boolean)
LANGUAGE sql SECURITY DEFINER SET search_path = core, pg_temp AS $$
  SELECT u.id, u.email, u.full_name, u.password_hash, u.status,
         u.failed_attempts, u.locked_until, u.totp_secret_enc, u.totp_enabled
    FROM core.users u
   WHERE u.id = p_id AND u.deleted_at IS NULL
$$;

CREATE OR REPLACE FUNCTION core.auth_record_login_failure(
  p_user uuid, p_lock_after int, p_lock_minutes int)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = core, pg_temp AS $$
  UPDATE core.users
     SET failed_attempts = failed_attempts + 1,
         locked_until = CASE WHEN failed_attempts + 1 >= p_lock_after
                             THEN now() + make_interval(mins => p_lock_minutes)
                             ELSE locked_until END
   WHERE id = p_user
$$;

CREATE OR REPLACE FUNCTION core.auth_record_login_success(p_user uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = core, pg_temp AS $$
  UPDATE core.users SET failed_attempts = 0, locked_until = NULL WHERE id = p_user
$$;

CREATE OR REPLACE FUNCTION core.auth_set_password(p_user uuid, p_hash text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = core, pg_temp AS $$
  UPDATE core.users
     SET password_hash = p_hash, failed_attempts = 0, locked_until = NULL
   WHERE id = p_user
$$;

DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'core.auth_lookup_user_by_email(citext)',
    'core.auth_lookup_user_by_id(uuid)',
    'core.auth_record_login_failure(uuid,int,int)',
    'core.auth_record_login_success(uuid)',
    'core.auth_set_password(uuid,text)'
  ] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO elimubora_auth', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO elimubora_app', fn);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- Invitations: the production onboarding path. Raw tokens are
-- never stored — SHA-256 hashes only.
-- ------------------------------------------------------------
CREATE TABLE core.invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES core.tenants(id),
  email       citext NOT NULL,
  role        text NOT NULL CHECK (role IN (
                'learner','teacher','parent','school_admin','principal',
                'county_officer','ministry_official','platform_admin')),
  invited_by  uuid NOT NULL REFERENCES core.users(id),
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invitations_tenant ON core.invitations (tenant_id, created_at DESC);

ALTER TABLE core.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.invitations FORCE ROW LEVEL SECURITY;

CREATE POLICY invitations_tenant ON core.invitations
  TO elimubora_app
  USING (tenant_id = core.current_tenant_id())
  WITH CHECK (tenant_id = core.current_tenant_id());

CREATE POLICY invitations_worker_read ON core.invitations
  FOR SELECT TO elimubora_worker USING (true);

CREATE POLICY invitations_auth_all ON core.invitations
  TO elimubora_auth USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON core.invitations TO elimubora_app;
GRANT SELECT ON core.invitations TO elimubora_worker;
GRANT SELECT ON core.invitations TO elimubora_auth;

-- Pre-auth acceptance lookup (the acceptor has no session yet).
CREATE OR REPLACE FUNCTION core.auth_lookup_invitation(p_token_hash text)
RETURNS TABLE (id uuid, tenant_id uuid, email citext, role text,
               expires_at timestamptz, accepted_at timestamptz, revoked_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = core, pg_temp AS $$
  SELECT i.id, i.tenant_id, i.email, i.role, i.expires_at, i.accepted_at, i.revoked_at
    FROM core.invitations i
   WHERE i.token_hash = p_token_hash
$$;

ALTER FUNCTION core.auth_lookup_invitation(text) OWNER TO elimubora_auth;
REVOKE ALL ON FUNCTION core.auth_lookup_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.auth_lookup_invitation(text) TO elimubora_app;

-- ------------------------------------------------------------
-- Password resets: auth infrastructure (hashes + user ids only),
-- accessed pre-authentication — like refresh_tokens, no RLS.
-- ------------------------------------------------------------
CREATE TABLE core.password_resets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES core.users(id),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_password_resets_user ON core.password_resets (user_id) WHERE used_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON core.password_resets TO elimubora_app;

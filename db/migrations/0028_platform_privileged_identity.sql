BEGIN;

CREATE SCHEMA IF NOT EXISTS platform;

CREATE TABLE IF NOT EXISTS platform.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  risk_level text NOT NULL DEFAULT 'standard' CHECK (risk_level IN ('standard','elevated','critical')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  description text NOT NULL,
  category text NOT NULL,
  requires_step_up boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform.role_permissions (
  role_id uuid NOT NULL REFERENCES platform.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES platform.permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS platform.access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES platform.roles(id),
  scope_type text NOT NULL CHECK (scope_type IN ('global','county','institution','resource')),
  scope_id text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','expired')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  granted_by uuid NOT NULL REFERENCES core.users(id),
  revoked_by uuid REFERENCES core.users(id),
  revoked_at timestamptz,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope_type = 'global' AND scope_id IS NULL) OR (scope_type <> 'global' AND scope_id IS NOT NULL)),
  CHECK (expires_at IS NULL OR expires_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_platform_access_grants_user_active ON platform.access_grants(user_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_platform_access_grants_scope ON platform.access_grants(scope_type, scope_id) WHERE status='active';

CREATE TABLE IF NOT EXISTS platform.privileged_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  assurance_level text NOT NULL CHECK (assurance_level IN ('password','mfa','hardware_key')),
  verified_at timestamptz,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES core.users(id),
  source_session_id uuid,
  ip inet,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS idx_platform_privileged_sessions_active ON platform.privileged_sessions(user_id, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS platform.impersonation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES core.users(id),
  target_user_id uuid NOT NULL REFERENCES core.users(id),
  target_tenant_id uuid REFERENCES core.tenants(id),
  reason text NOT NULL,
  ticket_reference text,
  status text NOT NULL DEFAULT 'pending_step_up' CHECK (status IN ('pending_step_up','approved','active','ended','denied','expired')),
  privileged_session_id uuid REFERENCES platform.privileged_sessions(id),
  approved_by uuid REFERENCES core.users(id),
  approved_at timestamptz,
  started_at timestamptz,
  expires_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (actor_user_id <> target_user_id)
);
CREATE INDEX IF NOT EXISTS idx_platform_impersonation_actor ON platform.impersonation_requests(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_impersonation_status ON platform.impersonation_requests(status, created_at DESC);

DROP TRIGGER IF EXISTS trg_platform_roles_updated ON platform.roles;
CREATE TRIGGER trg_platform_roles_updated BEFORE UPDATE ON platform.roles FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
DROP TRIGGER IF EXISTS trg_platform_access_grants_updated ON platform.access_grants;
CREATE TRIGGER trg_platform_access_grants_updated BEFORE UPDATE ON platform.access_grants FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
DROP TRIGGER IF EXISTS trg_platform_impersonation_updated ON platform.impersonation_requests;
CREATE TRIGGER trg_platform_impersonation_updated BEFORE UPDATE ON platform.impersonation_requests FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

INSERT INTO platform.roles (key, name, description, is_system, risk_level) VALUES
 ('platform.super_admin','Platform Super Admin','Full platform governance. Break-glass role with critical privileges.',true,'critical'),
 ('platform.operator','Platform Operator','Institution operations, service health, support and routine platform administration.',true,'elevated'),
 ('platform.security_admin','Security Administrator','Security alerts, sessions, investigations and privileged access review.',true,'critical'),
 ('platform.support_admin','Support Administrator','Support case management and safe institution/user diagnostics.',true,'standard'),
 ('platform.billing_admin','Billing Administrator','Plans, billing, sponsored institutions and payment administration.',true,'elevated'),
 ('platform.data_admin','Data Administrator','Data quality, exports, retention and migration administration.',true,'critical'),
 ('platform.ai_admin','AI Administrator','AI models, quotas, policies and safety governance.',true,'elevated')
ON CONFLICT (key) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, risk_level=EXCLUDED.risk_level;

INSERT INTO platform.permissions (key, description, category, requires_step_up) VALUES
 ('platform.overview.read','View platform-wide operational overview','platform',false),
 ('institution.read','View institutions across the platform','institution',false),
 ('institution.manage','Edit institution configuration and lifecycle','institution',true),
 ('institution.suspend','Suspend or reactivate an institution','institution',true),
 ('user.read','View platform user identities','identity',false),
 ('user.manage','Manage user status and identity details','identity',true),
 ('user.sessions.revoke','Revoke another user''s sessions','identity',true),
 ('access.roles.read','View roles and permission mappings','access',false),
 ('access.roles.manage','Create and change roles/permission mappings','access',true),
 ('access.grants.read','View scoped access grants','access',false),
 ('access.grants.manage','Grant or revoke scoped platform access','access',true),
 ('access.privileged_sessions.read','View privileged session registry','access',false),
 ('access.privileged_sessions.revoke','Revoke privileged sessions','access',true),
 ('access.impersonation.request','Create an audited impersonation request','access',true),
 ('access.impersonation.approve','Approve and activate impersonation after verified step-up','access',true),
 ('security.alerts.read','View security alerts','security',false),
 ('security.alerts.manage','Acknowledge and resolve security alerts','security',true),
 ('support.manage','Manage support tickets','support',false),
 ('feature_flags.manage','Manage feature rollout configuration','platform',true),
 ('operations.read','View platform service health','operations',false),
 ('audit.read','Search privileged audit activity','audit',false)
ON CONFLICT (key) DO UPDATE SET description=EXCLUDED.description, category=EXCLUDED.category, requires_step_up=EXCLUDED.requires_step_up;

-- Full permission set for the root role. Other system roles receive least-privilege mappings below.
INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM platform.roles r CROSS JOIN platform.permissions p
WHERE r.key='platform.super_admin'
ON CONFLICT DO NOTHING;

INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM platform.roles r JOIN platform.permissions p ON p.key = ANY(ARRAY[
 'platform.overview.read','institution.read','institution.manage','user.read','user.manage','user.sessions.revoke',
 'support.manage','operations.read','audit.read','access.grants.read','access.privileged_sessions.read'
]) WHERE r.key='platform.operator' ON CONFLICT DO NOTHING;

INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM platform.roles r JOIN platform.permissions p ON p.key = ANY(ARRAY[
 'platform.overview.read','user.read','user.sessions.revoke','access.roles.read','access.grants.read',
 'access.grants.manage','access.privileged_sessions.read','access.privileged_sessions.revoke',
 'access.impersonation.request','access.impersonation.approve','security.alerts.read','security.alerts.manage','audit.read'
]) WHERE r.key='platform.security_admin' ON CONFLICT DO NOTHING;

INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM platform.roles r JOIN platform.permissions p ON p.key = ANY(ARRAY[
 'platform.overview.read','institution.read','user.read','support.manage','operations.read'
]) WHERE r.key='platform.support_admin' ON CONFLICT DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON platform.roles, platform.permissions, platform.role_permissions, platform.access_grants, platform.privileged_sessions, platform.impersonation_requests TO elimubora_app;
GRANT SELECT ON platform.roles, platform.permissions, platform.role_permissions, platform.access_grants, platform.privileged_sessions, platform.impersonation_requests TO elimubora_worker;

COMMIT;

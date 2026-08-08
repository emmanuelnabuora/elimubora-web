-- 0031_platform_production_command.sql
--
-- Platform-wide incident, compliance-request, backup/restore, and
-- deployment tracking tables. Global operational data, not
-- tenant-RLS scoped (matching 0027-0030's precedent) -- access is
-- exclusively mediated by platform_admin-only API routes.
--
-- Important scope note, carried over from application-layer review:
-- platform.restore_requests and platform.deployments are tracking
-- and approval-workflow tables only. Nothing in this migration or the
-- API built on top of it actually triggers a real infrastructure
-- restore or deployment -- approving a restore request here only
-- flips a status column. That's a deliberate, honest scope boundary,
-- not an oversight.



CREATE SCHEMA IF NOT EXISTS platform;

CREATE TABLE IF NOT EXISTS platform.service_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_code text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('development','staging','production')),
  region text,
  status text NOT NULL CHECK (status IN ('healthy','degraded','down','maintenance','unknown')),
  latency_ms integer,
  error_rate numeric(7,4),
  cpu_percent numeric(7,3),
  memory_percent numeric(7,3),
  version text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_platform_service_health_service
  ON platform.service_health(service_code, environment, observed_at DESC);

CREATE TABLE IF NOT EXISTS platform.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_number text NOT NULL UNIQUE,
  title text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('sev1','sev2','sev3','sev4')),
  status text NOT NULL DEFAULT 'investigating'
    CHECK (status IN ('investigating','identified','monitoring','resolved','closed')),
  affected_services jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text,
  root_cause text,
  customer_impact text,
  started_at timestamptz NOT NULL DEFAULT now(),
  identified_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_by uuid,
  commander_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_incidents_status
  ON platform.incidents(status, severity, started_at DESC);

CREATE TABLE IF NOT EXISTS platform.incident_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES platform.incidents(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  message text NOT NULL,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_incident_events_incident
  ON platform.incident_events(incident_id, created_at);

CREATE TABLE IF NOT EXISTS platform.compliance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL UNIQUE,
  request_type text NOT NULL
    CHECK (request_type IN ('access','correction','deletion','restriction','objection','portability','breach','legal_hold')),
  subject_type text NOT NULL,
  subject_reference text NOT NULL,
  institution_id uuid,
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received','verifying','in_progress','waiting','completed','rejected','cancelled')),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal','high','urgent')),
  due_at timestamptz,
  assigned_to uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_compliance_requests_status
  ON platform.compliance_requests(status, due_at);

CREATE TABLE IF NOT EXISTS platform.backup_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_code text NOT NULL,
  backup_type text NOT NULL CHECK (backup_type IN ('full','incremental','snapshot','export')),
  status text NOT NULL CHECK (status IN ('running','completed','failed','expired')),
  region text,
  storage_reference text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  expires_at timestamptz,
  size_bytes bigint,
  checksum text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_platform_backup_snapshots_system
  ON platform.backup_snapshots(system_code, completed_at DESC);

CREATE TABLE IF NOT EXISTS platform.restore_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_snapshot_id uuid REFERENCES platform.backup_snapshots(id),
  requested_by uuid,
  approved_by uuid,
  environment text NOT NULL CHECK (environment IN ('staging','production')),
  status text NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval','approved','running','completed','failed','cancelled')),
  reason text NOT NULL,
  validation_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_platform_restore_requests_status
  ON platform.restore_requests(status, requested_at DESC);

CREATE TABLE IF NOT EXISTS platform.deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_code text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('development','staging','production')),
  version text NOT NULL,
  commit_sha text,
  status text NOT NULL CHECK (status IN ('queued','deploying','healthy','failed','rolled_back')),
  deployed_by uuid,
  region text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_platform_deployments_service
  ON platform.deployments(service_code, environment, started_at DESC);

CREATE TABLE IF NOT EXISTS platform.production_readiness_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_code text NOT NULL,
  category text NOT NULL,
  status text NOT NULL CHECK (status IN ('pass','warn','fail','not_run')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now(),
  checked_by uuid
);
CREATE INDEX IF NOT EXISTS idx_platform_prod_checks_latest
  ON platform.production_readiness_checks(check_code, checked_at DESC);



-- Without these, every query against these tables from the API's
-- own runtime role (elimubora_app) fails with "permission denied" --
-- a newly created table has no grants for any role but its owner by
-- default. Matches the exact precedent set in 0027-0030.
GRANT SELECT, INSERT, UPDATE ON
  platform.service_health, platform.incidents, platform.incident_events,
  platform.compliance_requests, platform.backup_snapshots, platform.restore_requests,
  platform.deployments, platform.production_readiness_checks
  TO elimubora_app;
GRANT SELECT ON
  platform.service_health, platform.incidents, platform.incident_events,
  platform.compliance_requests, platform.backup_snapshots, platform.restore_requests,
  platform.deployments, platform.production_readiness_checks
  TO elimubora_worker;

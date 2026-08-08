-- 0030_platform_intelligence.sql
--
-- Platform-wide national analytics, AI governance, and data
-- management tables. Global operational data, not tenant-RLS scoped
-- (matching 0027-0029's precedent) -- access is exclusively mediated
-- by platform_admin-only API routes.



CREATE SCHEMA IF NOT EXISTS platform;

CREATE TABLE IF NOT EXISTS platform.analytics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date date NOT NULL,
  scope_type text NOT NULL CHECK (scope_type IN ('national','county','institution_type','institution')),
  scope_key text NOT NULL,
  metric_key text NOT NULL,
  metric_value numeric NOT NULL DEFAULT 0,
  dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(metric_date, scope_type, scope_key, metric_key, dimensions)
);
CREATE INDEX IF NOT EXISTS idx_platform_analytics_daily_scope
  ON platform.analytics_daily(scope_type, scope_key, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_platform_analytics_daily_metric
  ON platform.analytics_daily(metric_key, metric_date DESC);

CREATE TABLE IF NOT EXISTS platform.ai_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  provider text NOT NULL,
  display_name text NOT NULL,
  model_version text,
  purpose text,
  status text NOT NULL DEFAULT 'disabled'
    CHECK (status IN ('disabled','sandbox','approved','restricted','retired')),
  data_classification text NOT NULL DEFAULT 'internal'
    CHECK (data_classification IN ('public','internal','confidential','restricted')),
  input_token_cost_micros bigint NOT NULL DEFAULT 0,
  output_token_cost_micros bigint NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  row_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform.ai_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  policy_scope text NOT NULL DEFAULT 'global'
    CHECK (policy_scope IN ('global','county','institution','role','feature')),
  scope_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  row_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform.ai_usage_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usage_date date NOT NULL,
  institution_id uuid,
  role_code text,
  feature_code text NOT NULL,
  model_code text NOT NULL,
  request_count bigint NOT NULL DEFAULT 0,
  blocked_count bigint NOT NULL DEFAULT 0,
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  estimated_cost_micros bigint NOT NULL DEFAULT 0,
  UNIQUE(usage_date, institution_id, role_code, feature_code, model_code)
);
CREATE INDEX IF NOT EXISTS idx_platform_ai_usage_date
  ON platform.ai_usage_daily(usage_date DESC);
CREATE INDEX IF NOT EXISTS idx_platform_ai_usage_institution
  ON platform.ai_usage_daily(institution_id, usage_date DESC);

CREATE TABLE IF NOT EXISTS platform.ai_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid,
  feature_code text NOT NULL,
  model_code text,
  risk_category text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','reviewing','resolved','dismissed')),
  reason_code text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  assigned_to uuid,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_ai_review_status
  ON platform.ai_review_queue(status, severity, created_at DESC);

CREATE TABLE IF NOT EXISTS platform.data_quality_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid,
  domain text NOT NULL,
  issue_code text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info','warning','error','critical')),
  entity_type text,
  entity_id text,
  summary text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','acknowledged','resolved','ignored')),
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);
CREATE INDEX IF NOT EXISTS idx_platform_data_quality_open
  ON platform.data_quality_issues(status, severity, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_data_quality_institution
  ON platform.data_quality_issues(institution_id, status);

CREATE TABLE IF NOT EXISTS platform.data_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid,
  institution_id uuid,
  export_type text NOT NULL,
  format text NOT NULL CHECK (format IN ('csv','json','xlsx','parquet')),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','completed','failed','expired','cancelled')),
  filter_spec jsonb NOT NULL DEFAULT '{}'::jsonb,
  storage_object_key text,
  row_count bigint,
  failure_code text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_platform_data_exports_requester
  ON platform.data_exports(requested_by, created_at DESC);

CREATE TABLE IF NOT EXISTS platform.retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,
  retention_days integer NOT NULL CHECK (retention_days > 0),
  archive_after_days integer CHECK (archive_after_days > 0),
  legal_hold boolean NOT NULL DEFAULT false,
  notes text,
  row_version bigint NOT NULL DEFAULT 1,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform.migration_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid,
  source_system text NOT NULL,
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','validating','running','completed','failed','cancelled','rolled_back')),
  records_total bigint NOT NULL DEFAULT 0,
  records_processed bigint NOT NULL DEFAULT 0,
  records_failed bigint NOT NULL DEFAULT 0,
  requested_by uuid,
  failure_code text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_platform_migration_jobs_status
  ON platform.migration_jobs(status, created_at DESC);

INSERT INTO platform.ai_models(code,provider,display_name,purpose,status,data_classification)
VALUES
 ('student_tutor_default','unconfigured','Student Tutor Default','Student tutoring','disabled','confidential'),
 ('teacher_copilot_default','unconfigured','Teacher Copilot Default','Teacher assistance','disabled','confidential'),
 ('ministry_analytics_default','unconfigured','Ministry Analytics Default','Aggregate analytics','disabled','internal')
ON CONFLICT(code) DO NOTHING;

INSERT INTO platform.ai_policies(code,name,description,rules)
VALUES
 ('student_privacy','Student privacy baseline','Restricts use of learner PII and private conversation access',
  '{"allow_private_conversation_admin_access":false,"require_human_review_for_high_risk":true}'::jsonb),
 ('ai_cost_guardrail','AI cost guardrail','Default budget and quota protections',
  '{"daily_budget_micros":0,"block_when_budget_exceeded":true}'::jsonb)
ON CONFLICT(code) DO NOTHING;



-- Without these, every query against these tables from the API's
-- own runtime role (elimubora_app) fails with "permission denied" --
-- a newly created table has no grants for any role but its owner by
-- default. Matches the exact precedent set in 0027-0029.
GRANT SELECT, INSERT, UPDATE ON
  platform.analytics_daily, platform.ai_models, platform.ai_policies, platform.ai_usage_daily,
  platform.ai_review_queue, platform.data_quality_issues, platform.data_exports,
  platform.retention_policies, platform.migration_jobs
  TO elimubora_app;
GRANT SELECT ON
  platform.analytics_daily, platform.ai_models, platform.ai_policies, platform.ai_usage_daily,
  platform.ai_review_queue, platform.data_quality_issues, platform.data_exports,
  platform.retention_policies, platform.migration_jobs
  TO elimubora_worker;

-- Platform Super Admin support tables. Global operational data is deliberately
-- not tenant-RLS scoped; access is exclusively mediated by platform_admin API routes.
CREATE SCHEMA IF NOT EXISTS platform;
GRANT USAGE ON SCHEMA platform TO elimubora_app, elimubora_worker;

CREATE TABLE platform.security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  severity text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  title text NOT NULL,
  detail text,
  source text NOT NULL DEFAULT 'platform',
  subject_user_id uuid REFERENCES core.users(id),
  subject_tenant_id uuid REFERENCES core.tenants(id),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved','dismissed')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  acknowledged_by uuid REFERENCES core.users(id),
  acknowledged_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_platform_security_alerts_open ON platform.security_alerts (created_at DESC) WHERE status='open';
CREATE TRIGGER trg_platform_security_alerts_updated BEFORE UPDATE ON platform.security_alerts FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

CREATE TABLE platform.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  tenant_id uuid REFERENCES core.tenants(id),
  requester_user_id uuid REFERENCES core.users(id),
  assigned_user_id uuid REFERENCES core.users(id),
  category text NOT NULL DEFAULT 'technical',
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  subject text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','assigned','waiting','escalated','resolved','closed')),
  last_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_platform_support_status ON platform.support_tickets (status, created_at DESC);
CREATE TRIGGER trg_platform_support_updated BEFORE UPDATE ON platform.support_tickets FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

CREATE TABLE platform.feature_flags (
  key text PRIMARY KEY,
  description text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  rollout_percentage int NOT NULL DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
  targeting jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES core.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_platform_feature_flags_updated BEFORE UPDATE ON platform.feature_flags FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

INSERT INTO platform.feature_flags (key, description, enabled, rollout_percentage) VALUES
  ('ai_tutor', 'Student AI Tutor', false, 0),
  ('mpesa_payments', 'M-Pesa payment workflows', true, 100),
  ('digital_exams', 'Digital examination delivery', false, 0),
  ('attendance_qr', 'QR attendance capture', false, 0),
  ('parent_messaging', 'Parent-teacher direct messaging', true, 100),
  ('offline_mode', 'Offline-first synchronization', true, 100)
ON CONFLICT (key) DO NOTHING;

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA platform TO elimubora_app;
GRANT SELECT ON ALL TABLES IN SCHEMA platform TO elimubora_worker;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA platform TO elimubora_app, elimubora_worker;

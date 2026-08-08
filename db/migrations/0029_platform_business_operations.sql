-- 0029_platform_business_operations.sql
--
-- Platform-wide billing, subscriptions, integrations, and broadcast
-- tables. Global operational data, deliberately not tenant-RLS scoped
-- (matching 0027/0028's precedent for the platform schema) -- access
-- is exclusively mediated by platform_admin-only API routes.

CREATE SCHEMA IF NOT EXISTS platform;

CREATE TABLE IF NOT EXISTS platform.plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE NOT NULL,
 name text NOT NULL, billing_interval text NOT NULL DEFAULT 'monthly',
 currency char(3) NOT NULL DEFAULT 'KES', price_minor bigint NOT NULL DEFAULT 0,
 active boolean NOT NULL DEFAULT true, features jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS platform.subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), institution_id uuid NOT NULL,
 plan_id uuid NOT NULL REFERENCES platform.plans(id),
 status text NOT NULL CHECK(status IN ('trial','active','past_due','suspended','cancelled','sponsored')),
 sponsor_name text, starts_at timestamptz NOT NULL DEFAULT now(), ends_at timestamptz,
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_platform_subscriptions_institution ON platform.subscriptions(institution_id);

CREATE TABLE IF NOT EXISTS platform.billing_invoices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), institution_id uuid NOT NULL,
 subscription_id uuid REFERENCES platform.subscriptions(id), invoice_number text UNIQUE NOT NULL,
 currency char(3) NOT NULL DEFAULT 'KES', total_minor bigint NOT NULL DEFAULT 0,
 amount_paid_minor bigint NOT NULL DEFAULT 0,
 status text NOT NULL CHECK(status IN ('draft','open','paid','void','overdue','waived')),
 due_at timestamptz, issued_at timestamptz, paid_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS platform.payment_transactions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), institution_id uuid, invoice_id uuid REFERENCES platform.billing_invoices(id),
 provider text NOT NULL, provider_reference text, currency char(3) NOT NULL DEFAULT 'KES',
 amount_minor bigint NOT NULL, status text NOT NULL CHECK(status IN ('pending','succeeded','failed','reversed','refunded')),
 failure_code text, occurred_at timestamptz NOT NULL DEFAULT now(), metadata jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_payment_reference ON platform.payment_transactions(provider,provider_reference)
 WHERE provider_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS platform.integration_config (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE NOT NULL, display_name text NOT NULL,
 category text NOT NULL, environment text NOT NULL DEFAULT 'production',
 status text NOT NULL DEFAULT 'not_configured', enabled boolean NOT NULL DEFAULT false,
 config jsonb NOT NULL DEFAULT '{}'::jsonb, last_success_at timestamptz, last_failure_at timestamptz,
 last_error_code text, latency_ms integer, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS platform.broadcasts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, body text NOT NULL,
 channel text NOT NULL CHECK(channel IN ('in_app','email','sms','push')),
 audience_type text NOT NULL CHECK(audience_type IN ('all','county','institution_type','institution','role')),
 audience_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending_approval','approved','publishing','published','cancelled')),
 created_by uuid, approved_by uuid, approved_at timestamptz, published_at timestamptz, scheduled_for timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

INSERT INTO platform.plans(code,name,billing_interval) VALUES
 ('starter','Starter','monthly'),('growth','Growth','monthly'),('national','National / Sponsored','sponsored')
ON CONFLICT(code) DO NOTHING;
INSERT INTO platform.integration_config(code,display_name,category) VALUES
 ('mpesa','M-Pesa','payments'),('airtel_money','Airtel Money','payments'),
 ('google_workspace','Google Workspace for Education','identity'),
 ('microsoft_365','Microsoft 365 Education','identity'),('sms','SMS Gateway','communications'),
 ('email','Email Provider','communications'),('nemis','NEMIS','government'),
 ('knec','KNEC','government'),('kicd','KICD','government')
ON CONFLICT(code) DO NOTHING;

-- Without these, every query against these tables from the API's
-- own runtime role (elimubora_app) fails with "permission denied" --
-- a newly created table has no grants for any role but its owner by
-- default. Matches the exact precedent set in 0027/0028.
GRANT SELECT, INSERT, UPDATE ON
  platform.plans, platform.subscriptions, platform.billing_invoices,
  platform.payment_transactions, platform.integration_config, platform.broadcasts
  TO elimubora_app;
GRANT SELECT ON
  platform.plans, platform.subscriptions, platform.billing_invoices,
  platform.payment_transactions, platform.integration_config, platform.broadcasts
  TO elimubora_worker;

-- ============================================================
-- 0016_government_dashboard.sql — Government Dashboard.
--
-- Scope decision: the original brief lists National/County Analytics,
-- Enrollment, Attendance, Teacher Distribution, Infrastructure,
-- School Performance, Funding, Policy Monitoring, Inspection Reports,
-- and an Early Warning System. This migration builds enrollment and
-- attendance rollups as the proven architectural slice; the rest
-- follow the identical snapshot pattern established here and are
-- straightforward additions once needed, not built shallow now.
--
-- ARCHITECTURAL NOTE — the first genuinely cross-tenant read path:
-- every prior aggregation (Teacher Dashboard, Parent Portal) reads
-- within ONE tenant's RLS context. National/county statistics
-- fundamentally cannot: a ministry official needs numbers spanning
-- every school. The answer is NOT bypassing RLS on a live per-request
-- query — it's a periodically-refreshed aggregate snapshot layer,
-- computed by a background job using the elimubora_worker role
-- (exactly the cross-tenant reader ADR-002 always anticipated),
-- writing into tables that have no tenant_id column at all because
-- the data is already aggregate (counts, rates) and carries no
-- individual student/tenant identity to protect via RLS. Access
-- control for WHO can read which slice (a county officer sees only
-- their own county; a ministry official/platform admin sees any/all)
-- is enforced in the service layer against the requester's own
-- tenant record — core.tenants already carries kind='county' and
-- county_code from Sprint 1, so no new "which county is this person"
-- data model is needed.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS gov;
GRANT USAGE ON SCHEMA gov TO elimubora_app, elimubora_worker;

CREATE TABLE gov.enrollment_snapshots (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  county_code       text,                 -- NULL = national rollup
  academic_year     int NOT NULL,
  total_students    int NOT NULL,
  total_schools     int NOT NULL,
  snapshot_taken_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_enrollment_snapshots_lookup
  ON gov.enrollment_snapshots (academic_year, county_code, snapshot_taken_at DESC);

-- The app role may only ever READ snapshots; only the worker role
-- (used exclusively by the background refresh job, never by ordinary
-- request handling) may write them. This makes it structurally
-- impossible for a normal API request to fabricate national statistics.
GRANT SELECT ON gov.enrollment_snapshots TO elimubora_app;
GRANT SELECT, INSERT ON gov.enrollment_snapshots TO elimubora_worker;
GRANT USAGE ON SEQUENCE gov.enrollment_snapshots_id_seq TO elimubora_worker;

CREATE TABLE gov.attendance_snapshots (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  county_code            text,             -- NULL = national rollup
  academic_year          int NOT NULL,
  average_attendance_rate numeric(5,2) NOT NULL,
  snapshot_taken_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_attendance_snapshots_lookup
  ON gov.attendance_snapshots (academic_year, county_code, snapshot_taken_at DESC);

GRANT SELECT ON gov.attendance_snapshots TO elimubora_app;
GRANT SELECT, INSERT ON gov.attendance_snapshots TO elimubora_worker;
GRANT USAGE ON SEQUENCE gov.attendance_snapshots_id_seq TO elimubora_worker;

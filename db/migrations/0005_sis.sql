-- ============================================================
-- 0005_sis.sql — Student Information System.
--
-- Conflict classes (ADR-003):
--   All tables here: staff-authored, online-only for now (no
--   sync mutation handler). Made syncable for the READ/pull feed
--   only, so a future offline SIS app can read rosters/allocations.
--
-- Design notes:
--   - Medical data lives in its own table (sis.student_medical) so
--     the common "list students" query never touches it — defense
--     in depth beyond the service-layer role check.
--   - sis.transfers is the first genuinely CROSS-TENANT table: its
--     RLS policy admits either the sending or receiving tenant.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS sis;
GRANT USAGE ON SCHEMA sis TO elimubora_app, elimubora_worker;

-- ------------------------------------------------------------
-- core.make_syncable: recreated here as a PERMANENT platform
-- utility. Migration 0004 defined an equivalent helper in the
-- learning schema and dropped it after use — a mistake, since every
-- subsequent module needing sync/RLS/audit plumbing has to declare
-- it identically. This version lives in core (used across schemas)
-- and is kept for all future migrations to call.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.make_syncable(p_table regclass) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON %s
                  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()',
                 replace(p_table::text, '.', '_'), p_table);
  EXECUTE format('CREATE TRIGGER trg_%s_version BEFORE UPDATE ON %s
                  FOR EACH ROW EXECUTE FUNCTION core.bump_row_version()',
                 replace(p_table::text, '.', '_'), p_table);
  EXECUTE format('CREATE TRIGGER trg_%s_changelog AFTER INSERT OR UPDATE OR DELETE ON %s
                  FOR EACH ROW EXECUTE FUNCTION core.log_change()',
                 replace(p_table::text, '.', '_'), p_table);
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', p_table);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', p_table);
  EXECUTE format('CREATE POLICY tenant_isolation ON %s TO elimubora_app
                  USING (tenant_id = core.current_tenant_id())
                  WITH CHECK (tenant_id = core.current_tenant_id())', p_table);
  EXECUTE format('CREATE POLICY worker_read ON %s FOR SELECT TO elimubora_worker USING (true)',
                 p_table);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %s TO elimubora_app', p_table);
  EXECUTE format('GRANT SELECT ON %s TO elimubora_worker', p_table);
END $$;

CREATE TABLE sis.guardians (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES core.tenants(id),
  full_name   text NOT NULL,
  phone       text,
  email       citext,
  national_id text,
  user_id     uuid REFERENCES core.users(id),  -- set once a parent-portal account exists
  row_version bigint NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
SELECT core.make_syncable('sis.guardians');

CREATE TABLE sis.student_profiles (
  student_id       uuid PRIMARY KEY REFERENCES core.users(id),
  tenant_id        uuid NOT NULL REFERENCES core.tenants(id),
  admission_number text NOT NULL,
  date_of_birth    date,
  gender           text CHECK (gender IN ('male', 'female')),
  status           text NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'transferred_out', 'graduated', 'withdrawn')),
  enrolled_at      timestamptz NOT NULL DEFAULT now(),
  row_version      bigint NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  UNIQUE (tenant_id, admission_number)
);
-- id column expected by make_syncable's change-log payload key; alias via view? Simpler:
-- change_log stores row_id as the primary key value directly (student_id here).
ALTER TABLE sis.student_profiles ADD COLUMN id uuid GENERATED ALWAYS AS (student_id) STORED;
SELECT core.make_syncable('sis.student_profiles');

-- Sensitive health data, deliberately separate — see file header.
CREATE TABLE sis.student_medical (
  student_id    uuid PRIMARY KEY REFERENCES sis.student_profiles(student_id),
  tenant_id     uuid NOT NULL REFERENCES core.tenants(id),
  blood_group   text,
  allergies     text,
  medical_notes text,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sis.student_medical ENABLE ROW LEVEL SECURITY;
ALTER TABLE sis.student_medical FORCE ROW LEVEL SECURITY;
CREATE POLICY student_medical_tenant ON sis.student_medical
  TO elimubora_app
  USING (tenant_id = core.current_tenant_id())
  WITH CHECK (tenant_id = core.current_tenant_id());
GRANT SELECT, INSERT, UPDATE ON sis.student_medical TO elimubora_app;
-- Deliberately NOT made syncable: never appears in the pull feed,
-- never cached on a device, never leaves the server except through
-- the authenticated, role-gated medical-record endpoint.

CREATE TABLE sis.student_guardians (
  id           uuid PRIMARY KEY,
  tenant_id    uuid NOT NULL REFERENCES core.tenants(id),
  student_id   uuid NOT NULL REFERENCES sis.student_profiles(student_id),
  guardian_id  uuid NOT NULL REFERENCES sis.guardians(id),
  relationship text NOT NULL,             -- 'mother','father','uncle', etc.
  is_primary   boolean NOT NULL DEFAULT false,
  can_pickup   boolean NOT NULL DEFAULT true,
  row_version  bigint NOT NULL DEFAULT 1,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  UNIQUE (student_id, guardian_id)
);
CREATE INDEX idx_student_guardians_student ON sis.student_guardians (student_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_student_guardians_guardian ON sis.student_guardians (guardian_id) WHERE deleted_at IS NULL;
SELECT core.make_syncable('sis.student_guardians');

CREATE TABLE sis.class_streams (
  id                  uuid PRIMARY KEY,
  tenant_id           uuid NOT NULL REFERENCES core.tenants(id),
  name                text NOT NULL,        -- 'Grade 4 Blue'
  grade_level         text NOT NULL,
  academic_year       int NOT NULL,
  homeroom_teacher_id uuid REFERENCES core.users(id),
  row_version         bigint NOT NULL DEFAULT 1,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,
  UNIQUE (tenant_id, name, academic_year)
);
SELECT core.make_syncable('sis.class_streams');

CREATE TABLE sis.class_allocations (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES core.tenants(id),
  student_id      uuid NOT NULL REFERENCES sis.student_profiles(student_id),
  class_stream_id uuid NOT NULL REFERENCES sis.class_streams(id),
  academic_year   int NOT NULL,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  allocated_at    timestamptz NOT NULL DEFAULT now(),
  ended_at        timestamptz,
  row_version     bigint NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  UNIQUE (student_id, academic_year)
);
CREATE INDEX idx_allocations_stream ON sis.class_allocations (class_stream_id) WHERE deleted_at IS NULL;
SELECT core.make_syncable('sis.class_allocations');

CREATE TABLE sis.admission_applications (
  id                 uuid PRIMARY KEY,
  tenant_id          uuid NOT NULL REFERENCES core.tenants(id),
  candidate_name     text NOT NULL,
  date_of_birth      date,
  guardian_name      text NOT NULL,
  guardian_phone     text NOT NULL,
  grade_level_applied text NOT NULL,
  status             text NOT NULL DEFAULT 'submitted'
                     CHECK (status IN ('submitted', 'under_review', 'admitted', 'rejected', 'waitlisted')),
  reviewed_by        uuid REFERENCES core.users(id),
  decided_at         timestamptz,
  notes              text,
  row_version        bigint NOT NULL DEFAULT 1,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);
SELECT core.make_syncable('sis.admission_applications');

-- Cross-tenant: a transfer request is visible to BOTH the sending and
-- receiving school. RLS admits either side rather than a single
-- tenant_id column — the only table in the platform with this shape.
CREATE TABLE sis.transfers (
  id             uuid PRIMARY KEY,
  from_tenant_id uuid NOT NULL REFERENCES core.tenants(id),
  to_tenant_id   uuid NOT NULL REFERENCES core.tenants(id) CHECK (to_tenant_id <> from_tenant_id),
  student_id     uuid NOT NULL REFERENCES sis.student_profiles(student_id),
  requested_by   uuid NOT NULL REFERENCES core.users(id),
  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  reason         text,
  decided_by     uuid REFERENCES core.users(id),
  decided_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_transfers_from ON sis.transfers (from_tenant_id);
CREATE INDEX idx_transfers_to ON sis.transfers (to_tenant_id);
CREATE TRIGGER trg_transfers_updated BEFORE UPDATE ON sis.transfers
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

ALTER TABLE sis.transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sis.transfers FORCE ROW LEVEL SECURITY;
CREATE POLICY transfers_either_side ON sis.transfers
  TO elimubora_app
  USING (core.current_tenant_id() IN (from_tenant_id, to_tenant_id))
  WITH CHECK (core.current_tenant_id() IN (from_tenant_id, to_tenant_id));
GRANT SELECT, INSERT, UPDATE ON sis.transfers TO elimubora_app;

CREATE TABLE sis.graduations (
  id           uuid PRIMARY KEY,
  tenant_id    uuid NOT NULL REFERENCES core.tenants(id),
  student_id   uuid NOT NULL REFERENCES sis.student_profiles(student_id),
  cohort_year  int NOT NULL,
  graduated_at timestamptz NOT NULL DEFAULT now(),
  notes        text,
  UNIQUE (student_id)
);
ALTER TABLE sis.graduations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sis.graduations FORCE ROW LEVEL SECURITY;
CREATE POLICY graduations_tenant ON sis.graduations
  TO elimubora_app
  USING (tenant_id = core.current_tenant_id())
  WITH CHECK (tenant_id = core.current_tenant_id());
GRANT SELECT, INSERT ON sis.graduations TO elimubora_app;

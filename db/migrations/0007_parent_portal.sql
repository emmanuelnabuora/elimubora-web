-- ============================================================
-- 0007_parent_portal.sql — Parent Portal.
--
-- Parent Portal is primarily a READ composition surface (attendance,
-- homework, performance are already owned by Teacher Portal and
-- Learning; this migration adds only the two genuinely new entities
-- it introduces: announcements and behaviour notes. Guardian-scoped
-- messaging is Sprint 12 (Communication) scope — a real conversation/
-- message model is out of place here. Fees/payments views arrive
-- alongside Finance (Sprint 9).
-- ============================================================

CREATE SCHEMA IF NOT EXISTS comms;
GRANT USAGE ON SCHEMA comms TO elimubora_app, elimubora_worker;

CREATE TABLE comms.announcements (
  id           uuid PRIMARY KEY,
  tenant_id    uuid NOT NULL REFERENCES core.tenants(id),
  title        text NOT NULL,
  body         text NOT NULL,
  grade_level  text,                    -- NULL = whole school
  created_by   uuid NOT NULL REFERENCES core.users(id),
  row_version  bigint NOT NULL DEFAULT 1,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);
CREATE INDEX idx_announcements_tenant_time
  ON comms.announcements (tenant_id, created_at DESC) WHERE deleted_at IS NULL;
SELECT core.make_syncable('comms.announcements');

CREATE TABLE sis.behaviour_notes (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES core.tenants(id),
  student_id  uuid NOT NULL REFERENCES sis.student_profiles(student_id),
  category    text NOT NULL CHECK (category IN ('positive', 'concern', 'incident')),
  note        text NOT NULL,
  recorded_by uuid NOT NULL REFERENCES core.users(id),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE INDEX idx_behaviour_notes_student
  ON sis.behaviour_notes (student_id, occurred_at DESC) WHERE deleted_at IS NULL;
SELECT core.make_syncable('sis.behaviour_notes');

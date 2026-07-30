-- ============================================================
-- 0006_teacher_portal.sql — Teacher Portal.
--
-- Conflict class demonstrated (ADR-003 / ADR-009): attendance is
-- LAST-WRITE-WINS. Contrast with Sprint 4's submissions, which are
-- CREATE-ONLY (first write wins, unique constraint enforced). Here,
-- whichever mutation the server applies last for a given
-- (class_stream, learner, date) simply overwrites — no merge, no
-- rejection. This is the correct real-world behavior: if a teacher's
-- phone and a teaching assistant's tablet both mark the same
-- student's attendance for the same day while offline, the one that
-- syncs last should win outright, not be flagged as a conflict a
-- human has to resolve.
--
-- AI-assisted lesson planning and exam generation (from the original
-- brief's Module 13/Teacher Portal features) are explicitly deferred
-- to Sprint 12 (AI Platform); this migration builds the plain data
-- substrate (lesson_plans) those features will read and write.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS teacherportal;
GRANT USAGE ON SCHEMA teacherportal TO elimubora_app, elimubora_worker;

CREATE TABLE teacherportal.attendance_records (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES core.tenants(id),
  class_stream_id uuid NOT NULL REFERENCES sis.class_streams(id),
  learner_id      uuid NOT NULL REFERENCES core.users(id),
  attendance_date date NOT NULL,
  status          text NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  recorded_by     uuid NOT NULL REFERENCES core.users(id),
  row_version     bigint NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  UNIQUE (class_stream_id, learner_id, attendance_date)
);
CREATE INDEX idx_attendance_class_date
  ON teacherportal.attendance_records (class_stream_id, attendance_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_attendance_learner
  ON teacherportal.attendance_records (learner_id) WHERE deleted_at IS NULL;
SELECT core.make_syncable('teacherportal.attendance_records');

CREATE TABLE teacherportal.lesson_plans (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES core.tenants(id),
  course_id   uuid NOT NULL REFERENCES learning.courses(id),
  teacher_id  uuid NOT NULL REFERENCES core.users(id),
  week_of     date NOT NULL,
  objectives  text,
  activities  jsonb NOT NULL DEFAULT '[]'::jsonb,
  resources   text,
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved')),
  row_version bigint NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  UNIQUE (course_id, teacher_id, week_of)
);
CREATE INDEX idx_lesson_plans_course ON teacherportal.lesson_plans (course_id) WHERE deleted_at IS NULL;
SELECT core.make_syncable('teacherportal.lesson_plans');

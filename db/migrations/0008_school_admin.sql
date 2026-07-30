-- ============================================================
-- 0008_school_admin.sql — School Administration.
--
-- Scope decision: the original brief lists 12 sub-systems under
-- School Administration (Timetables, Rooms, Transport, Hostels,
-- Meals, Library, Inventory, Assets, Procurement, Maintenance, HR,
-- Payroll, Leave Management). Each is real sub-system-sized work.
-- This migration builds the two with the widest architectural
-- payoff — Timetabling (nearly everything else in the platform
-- eventually hangs off it) and Leave Management (the first HR
-- primitive) — and defers Transport/Hostels/Meals/Inventory/
-- Procurement/Maintenance/Payroll to dedicated future sprints.
--
-- Timetable conflict prevention is done with Postgres EXCLUDE
-- constraints (not just an application-layer check): a teacher, a
-- room, and a class stream can each only be in one place at a time,
-- enforced atomically by the database using range-overlap exclusion.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE SCHEMA IF NOT EXISTS schooladmin;
GRANT USAGE ON SCHEMA schooladmin TO elimubora_app, elimubora_worker;

CREATE TABLE schooladmin.rooms (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES core.tenants(id),
  name        text NOT NULL,
  capacity    int,
  room_type   text NOT NULL DEFAULT 'classroom'
              CHECK (room_type IN ('classroom', 'lab', 'hall', 'office', 'other')),
  row_version bigint NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  UNIQUE (tenant_id, name)
);
SELECT core.make_syncable('schooladmin.rooms');

CREATE TABLE schooladmin.timetable_slots (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES core.tenants(id),
  class_stream_id uuid NOT NULL REFERENCES sis.class_streams(id),
  course_id       uuid NOT NULL REFERENCES learning.courses(id),
  teacher_id      uuid NOT NULL REFERENCES core.users(id),
  room_id         uuid NOT NULL REFERENCES schooladmin.rooms(id),
  academic_year   int NOT NULL,
  day_of_week     smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1=Monday .. 7=Sunday
  start_min       smallint NOT NULL CHECK (start_min BETWEEN 0 AND 1439),
  end_min         smallint NOT NULL CHECK (end_min BETWEEN 1 AND 1440),
  time_range      int4range GENERATED ALWAYS AS (int4range(start_min, end_min, '[)')) STORED,
  row_version     bigint NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  CHECK (end_min > start_min),

  -- Database-enforced conflict prevention: a teacher, a room, and a
  -- class stream can each only be scheduled once for any overlapping
  -- interval on the same day of the same academic year. These fire on
  -- INSERT/UPDATE regardless of application logic — the guarantee
  -- holds even against a future bulk-import script or a bug elsewhere.
  CONSTRAINT no_teacher_double_booking
    EXCLUDE USING gist (
      tenant_id WITH =, teacher_id WITH =, academic_year WITH =,
      day_of_week WITH =, time_range WITH &&
    ) WHERE (deleted_at IS NULL),
  CONSTRAINT no_room_double_booking
    EXCLUDE USING gist (
      tenant_id WITH =, room_id WITH =, academic_year WITH =,
      day_of_week WITH =, time_range WITH &&
    ) WHERE (deleted_at IS NULL),
  CONSTRAINT no_class_stream_double_booking
    EXCLUDE USING gist (
      tenant_id WITH =, class_stream_id WITH =, academic_year WITH =,
      day_of_week WITH =, time_range WITH &&
    ) WHERE (deleted_at IS NULL)
);
CREATE INDEX idx_timetable_class ON schooladmin.timetable_slots (class_stream_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_timetable_teacher ON schooladmin.timetable_slots (teacher_id) WHERE deleted_at IS NULL;
SELECT core.make_syncable('schooladmin.timetable_slots');

CREATE TABLE schooladmin.leave_requests (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES core.tenants(id),
  staff_id    uuid NOT NULL REFERENCES core.users(id),
  leave_type  text NOT NULL CHECK (leave_type IN
              ('sick', 'annual', 'compassionate', 'maternity', 'paternity', 'unpaid')),
  start_date  date NOT NULL,
  end_date    date NOT NULL CHECK (end_date >= start_date),
  reason      text,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by  uuid REFERENCES core.users(id),
  decided_at  timestamptz,
  row_version bigint NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE INDEX idx_leave_requests_staff ON schooladmin.leave_requests (staff_id) WHERE deleted_at IS NULL;
SELECT core.make_syncable('schooladmin.leave_requests');

-- ============================================================
-- 0004_learning.sql
-- 1) Sync infrastructure: trigger-maintained change log (pull
--    feed) and idempotent applied-mutations ledger (push).
-- 2) Learning domain: CBC-aware courses, modules, lessons,
--    competencies, assignments, enrollments, submissions.
--
-- Conflict classes (ADR-003) declared per table below:
--   submissions: create-only via idempotent mutations, then
--                server-authoritative grading fields.
--   everything else in this migration: online-authored
--                (teachers), replicated read-only to clients.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS learning;
GRANT USAGE ON SCHEMA learning TO elimubora_app, elimubora_worker;

-- ------------------------------------------------------------
-- Change log: every committed write to a syncable table appends
-- one row. Clients pull WHERE seq > cursor. A short visibility
-- delay in the pull query (see ADR-007) bounds the out-of-order
-- commit window of the global sequence.
-- ------------------------------------------------------------
CREATE TABLE core.change_log (
  seq        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id  uuid NOT NULL,
  table_name text NOT NULL,
  row_id     uuid NOT NULL,
  op         text NOT NULL CHECK (op IN ('insert','update','delete')),
  row_version bigint NOT NULL,
  payload    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_change_log_tenant_seq ON core.change_log (tenant_id, seq);

ALTER TABLE core.change_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.change_log FORCE ROW LEVEL SECURITY;
CREATE POLICY change_log_tenant ON core.change_log
  TO elimubora_app
  USING (tenant_id = core.current_tenant_id())
  WITH CHECK (tenant_id = core.current_tenant_id());
CREATE POLICY change_log_worker_read ON core.change_log
  FOR SELECT TO elimubora_worker USING (true);
GRANT SELECT, INSERT ON core.change_log TO elimubora_app;
GRANT SELECT ON core.change_log TO elimubora_worker;

-- Version bump: BEFORE, so the row carries its new version.
CREATE OR REPLACE FUNCTION core.bump_row_version() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.row_version := OLD.row_version + 1;
  END IF;
  RETURN NEW;
END $$;

-- Change capture: AFTER, logging the final row image.
CREATE OR REPLACE FUNCTION core.log_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO core.change_log (tenant_id, table_name, row_id, op, row_version, payload)
    VALUES (OLD.tenant_id, TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, OLD.id, 'delete',
            OLD.row_version, NULL);
    RETURN OLD;
  END IF;
  INSERT INTO core.change_log (tenant_id, table_name, row_id, op, row_version, payload)
  VALUES (NEW.tenant_id, TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, NEW.id, lower(TG_OP),
          NEW.row_version, to_jsonb(NEW));
  RETURN NEW;
END $$;

-- ------------------------------------------------------------
-- Applied mutations: the push-side idempotency ledger. A replayed
-- mutation (offline queue retry) returns its stored result instead
-- of re-executing.
-- ------------------------------------------------------------
CREATE TABLE core.applied_mutations (
  mutation_id uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL,
  actor_id    uuid NOT NULL,
  type        text NOT NULL,
  result      jsonb NOT NULL,
  applied_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_applied_mutations_tenant ON core.applied_mutations (tenant_id, applied_at DESC);

ALTER TABLE core.applied_mutations ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.applied_mutations FORCE ROW LEVEL SECURITY;
CREATE POLICY applied_mutations_tenant ON core.applied_mutations
  TO elimubora_app
  USING (tenant_id = core.current_tenant_id())
  WITH CHECK (tenant_id = core.current_tenant_id());
GRANT SELECT, INSERT ON core.applied_mutations TO elimubora_app;

-- ------------------------------------------------------------
-- Helper to declare a syncable learning table's shared plumbing.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION learning.make_syncable(p_table regclass) RETURNS void
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

-- ------------------------------------------------------------
-- CBC structure: a course belongs to a learning area and grade;
-- competencies are the CBC strand/sub-strand outcomes assignments
-- assess against.
-- ------------------------------------------------------------
CREATE TABLE learning.courses (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES core.tenants(id),
  title         text NOT NULL,
  description   text,
  learning_area text NOT NULL,          -- e.g. 'Mathematics', 'Kiswahili'
  grade_level   text NOT NULL,          -- CBC: 'PP1'..'PP2','G1'..'G12'
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_by    uuid NOT NULL,
  row_version   bigint NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE INDEX idx_courses_tenant ON learning.courses (tenant_id, grade_level) WHERE deleted_at IS NULL;
SELECT learning.make_syncable('learning.courses');

CREATE TABLE learning.course_modules (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES core.tenants(id),
  course_id   uuid NOT NULL REFERENCES learning.courses(id),
  title       text NOT NULL,
  position    int NOT NULL,
  row_version bigint NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  UNIQUE (course_id, position)
);
CREATE INDEX idx_modules_course ON learning.course_modules (course_id) WHERE deleted_at IS NULL;
SELECT learning.make_syncable('learning.course_modules');

CREATE TABLE learning.lessons (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES core.tenants(id),
  module_id   uuid NOT NULL REFERENCES learning.course_modules(id),
  title       text NOT NULL,
  position    int NOT NULL,
  content     jsonb NOT NULL DEFAULT '{}'::jsonb,   -- block-structured; offline-renderable
  row_version bigint NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  UNIQUE (module_id, position)
);
CREATE INDEX idx_lessons_module ON learning.lessons (module_id) WHERE deleted_at IS NULL;
SELECT learning.make_syncable('learning.lessons');

CREATE TABLE learning.competencies (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES core.tenants(id),
  code        text NOT NULL,             -- e.g. 'MATH.G4.NUM.1.2'
  title       text NOT NULL,
  strand      text NOT NULL,
  sub_strand  text,
  row_version bigint NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  UNIQUE (tenant_id, code)
);
SELECT learning.make_syncable('learning.competencies');

CREATE TABLE learning.assignments (
  id           uuid PRIMARY KEY,
  tenant_id    uuid NOT NULL REFERENCES core.tenants(id),
  course_id    uuid NOT NULL REFERENCES learning.courses(id),
  title        text NOT NULL,
  instructions text,
  due_at       timestamptz,
  max_score    numeric(6,2) NOT NULL DEFAULT 100,
  rubric       jsonb,                     -- CBC rubric: EE/ME/AE/BE descriptors
  competency_ids uuid[] NOT NULL DEFAULT '{}',
  row_version  bigint NOT NULL DEFAULT 1,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);
CREATE INDEX idx_assignments_course ON learning.assignments (course_id) WHERE deleted_at IS NULL;
SELECT learning.make_syncable('learning.assignments');

CREATE TABLE learning.enrollments (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES core.tenants(id),
  course_id   uuid NOT NULL REFERENCES learning.courses(id),
  user_id     uuid NOT NULL REFERENCES core.users(id),
  course_role text NOT NULL CHECK (course_role IN ('learner','teacher')),
  row_version bigint NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  UNIQUE (course_id, user_id)
);
CREATE INDEX idx_enrollments_user ON learning.enrollments (user_id) WHERE deleted_at IS NULL;
SELECT learning.make_syncable('learning.enrollments');

-- Submissions: THE offline-first entity. Created via idempotent sync
-- mutations (learner may be offline for days); grading fields are
-- server-authoritative and only teachers write them.
CREATE TABLE learning.submissions (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES core.tenants(id),
  assignment_id uuid NOT NULL REFERENCES learning.assignments(id),
  learner_id    uuid NOT NULL REFERENCES core.users(id),
  content       jsonb NOT NULL,
  status        text NOT NULL DEFAULT 'submitted'
                CHECK (status IN ('submitted','graded','returned')),
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  score         numeric(6,2),
  rubric_levels jsonb,                    -- per-competency EE/ME/AE/BE
  feedback      text,
  graded_by     uuid,
  graded_at     timestamptz,
  row_version   bigint NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  UNIQUE (assignment_id, learner_id)
);
CREATE INDEX idx_submissions_assignment ON learning.submissions (assignment_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_submissions_learner ON learning.submissions (learner_id) WHERE deleted_at IS NULL;
SELECT learning.make_syncable('learning.submissions');

DROP FUNCTION learning.make_syncable(regclass);

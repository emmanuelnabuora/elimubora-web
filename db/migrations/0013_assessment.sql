-- ============================================================
-- 0013_assessment.sql — Assessment Platform.
--
-- Scope decision: the original brief lists CATs, Continuous
-- Assessment, CBC Competencies, Exams, Question Banks, Randomization,
-- Secure Browser, AI Marking, Rubrics, Certificates. CBC competencies
-- and rubrics already exist (learning.assignments/submissions, Sprint
-- 4). This migration adds formal exams: question banks, randomized
-- per-attempt question selection, auto-graded MCQs, manually-graded
-- short-answer/essay, and certificates. AI-assisted marking is Sprint
-- 12 (AI Platform) scope; a lockdown "Secure Browser" client is a
-- Mobile/Desktop app concern (Sprint 15) — this migration builds the
-- data substrate both will use.
--
-- DELIBERATE EXCLUSION FROM SYNC: question_banks, questions, and exams
-- do NOT go through core.make_syncable. Every prior syncable table
-- was excluded only for privacy (student_medical). This is the first
-- exclusion for a DIFFERENT reason — integrity. If exam questions
-- entered the general change-log pull feed, any client with tenant
-- access could download the full question bank before sitting the
-- exam. Randomized per-attempt question selection is worthless if the
-- questions are already sitting in a local cache. exam_attempts is
-- likewise a plain online-only table, no sync participation.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS assessment;
GRANT USAGE ON SCHEMA assessment TO elimubora_app, elimubora_worker;

CREATE TABLE assessment.question_banks (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES core.tenants(id),
  title       text NOT NULL,
  subject     text NOT NULL,
  grade_level text NOT NULL,
  created_by  uuid NOT NULL REFERENCES core.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE TRIGGER trg_question_banks_updated BEFORE UPDATE ON assessment.question_banks
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
ALTER TABLE assessment.question_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment.question_banks FORCE ROW LEVEL SECURITY;
CREATE POLICY question_banks_tenant ON assessment.question_banks
  TO elimubora_app
  USING (tenant_id = core.current_tenant_id())
  WITH CHECK (tenant_id = core.current_tenant_id());
GRANT SELECT, INSERT, UPDATE ON assessment.question_banks TO elimubora_app;

CREATE TABLE assessment.questions (
  id               uuid PRIMARY KEY,
  tenant_id        uuid NOT NULL REFERENCES core.tenants(id),
  bank_id          uuid NOT NULL REFERENCES assessment.question_banks(id),
  question_type    text NOT NULL CHECK (question_type IN ('mcq', 'short_answer', 'essay')),
  prompt           text NOT NULL,
  options          jsonb,                 -- mcq only: [{id, text}, ...]
  correct_option_id text,                 -- mcq only
  marks            numeric(6,2) NOT NULL CHECK (marks > 0),
  competency_ids   uuid[] NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  CHECK (question_type <> 'mcq' OR (options IS NOT NULL AND correct_option_id IS NOT NULL))
);
CREATE INDEX idx_questions_bank ON assessment.questions (bank_id) WHERE deleted_at IS NULL;
CREATE TRIGGER trg_questions_updated BEFORE UPDATE ON assessment.questions
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
ALTER TABLE assessment.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment.questions FORCE ROW LEVEL SECURITY;
CREATE POLICY questions_tenant ON assessment.questions
  TO elimubora_app
  USING (tenant_id = core.current_tenant_id())
  WITH CHECK (tenant_id = core.current_tenant_id());
GRANT SELECT, INSERT, UPDATE ON assessment.questions TO elimubora_app;

CREATE TABLE assessment.exams (
  id               uuid PRIMARY KEY,
  tenant_id        uuid NOT NULL REFERENCES core.tenants(id),
  course_id        uuid NOT NULL REFERENCES learning.courses(id),
  question_bank_id uuid NOT NULL REFERENCES assessment.question_banks(id),
  title            text NOT NULL,
  duration_minutes int NOT NULL CHECK (duration_minutes > 0),
  question_count   int NOT NULL CHECK (question_count > 0),
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  created_by       uuid NOT NULL REFERENCES core.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);
CREATE TRIGGER trg_exams_updated BEFORE UPDATE ON assessment.exams
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
ALTER TABLE assessment.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment.exams FORCE ROW LEVEL SECURITY;
CREATE POLICY exams_tenant ON assessment.exams
  TO elimubora_app
  USING (tenant_id = core.current_tenant_id())
  WITH CHECK (tenant_id = core.current_tenant_id());
GRANT SELECT, INSERT, UPDATE ON assessment.exams TO elimubora_app;

-- Plain online-only table — NOT syncable, no offline attempts.
-- question_ids freezes the randomized draw the learner actually saw,
-- so grading/review is always against the exact set presented,
-- regardless of later changes to the question bank.
CREATE TABLE assessment.exam_attempts (
  id             uuid PRIMARY KEY,
  tenant_id      uuid NOT NULL REFERENCES core.tenants(id),
  exam_id        uuid NOT NULL REFERENCES assessment.exams(id),
  learner_id     uuid NOT NULL REFERENCES core.users(id),
  question_ids   uuid[] NOT NULL,
  answers        jsonb NOT NULL DEFAULT '{}'::jsonb,   -- { questionId: answer }
  status         text NOT NULL DEFAULT 'in_progress'
                 CHECK (status IN ('in_progress', 'submitted', 'graded')),
  started_at     timestamptz NOT NULL DEFAULT now(),
  submitted_at   timestamptz,
  auto_score     numeric(6,2) NOT NULL DEFAULT 0,
  manual_score   numeric(6,2) NOT NULL DEFAULT 0,
  final_score    numeric(6,2) GENERATED ALWAYS AS (auto_score + manual_score) STORED,
  graded_by      uuid REFERENCES core.users(id),
  graded_at      timestamptz,
  UNIQUE (exam_id, learner_id)
);
CREATE INDEX idx_exam_attempts_exam ON assessment.exam_attempts (exam_id);
ALTER TABLE assessment.exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment.exam_attempts FORCE ROW LEVEL SECURITY;
CREATE POLICY exam_attempts_tenant ON assessment.exam_attempts
  TO elimubora_app
  USING (tenant_id = core.current_tenant_id())
  WITH CHECK (tenant_id = core.current_tenant_id());
GRANT SELECT, INSERT, UPDATE ON assessment.exam_attempts TO elimubora_app;

CREATE TABLE assessment.certificates (
  id                  uuid PRIMARY KEY,
  tenant_id           uuid NOT NULL REFERENCES core.tenants(id),
  student_id          uuid NOT NULL REFERENCES core.users(id),
  title               text NOT NULL,
  certificate_number  text NOT NULL,
  awarded_by          uuid NOT NULL REFERENCES core.users(id),
  issued_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, certificate_number)
);
SELECT core.make_syncable('assessment.certificates');

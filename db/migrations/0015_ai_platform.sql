-- ============================================================
-- 0015_ai_platform.sql — AI Platform.
--
-- Scope decision: the original brief describes AI features for four
-- personas (student, teacher, administrator, government). This
-- migration supports the teacher-facing features (lesson plan
-- drafting, exam question drafting) and a student-facing homework
-- helper. Administrator/Government AI (reports, forecasting, dropout
-- prediction) is explicitly deferred to Sprints 13-14 (Government
-- Dashboard, Analytics), where the underlying data aggregation
-- belongs anyway — building predictive features now would duplicate
-- that work.
--
-- SAFETY DESIGN, not an afterthought: every table change here exists
-- to keep a human in the loop before AI-originated content reaches a
-- student.
--   - assessment.questions gains ai_generated + review_status. The
--     existing random-draw query (AssessmentRepository) is updated in
--     this sprint to select ONLY review_status = 'approved' questions
--     — an AI-drafted question sits at 'pending' and is structurally
--     unselectable for a real exam attempt until a teacher approves it.
--   - teacherportal.lesson_plans gains ai_generated. The existing
--     draft -> submitted -> approved workflow (Sprint 6) is reused
--     unchanged; AI just becomes another way to CREATE a draft.
--   - ai.interactions logs every AI call platform-wide (which
--     persona, what was asked, what came back) for audit and, for the
--     homework-helper feature specifically, for future guardian
--     visibility (Parent Portal) — deliberately NOT syncable, since
--     it may contain a specific child's question content.
-- ============================================================

ALTER TABLE assessment.questions
  ADD COLUMN ai_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN review_status text NOT NULL DEFAULT 'approved'
    CHECK (review_status IN ('approved', 'pending', 'rejected'));

ALTER TABLE teacherportal.lesson_plans
  ADD COLUMN ai_generated boolean NOT NULL DEFAULT false;

CREATE SCHEMA IF NOT EXISTS ai;
GRANT USAGE ON SCHEMA ai TO elimubora_app, elimubora_worker;

CREATE TABLE ai.interactions (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES core.tenants(id),
  user_id         uuid NOT NULL REFERENCES core.users(id),
  feature         text NOT NULL CHECK (feature IN
                  ('lesson_plan_draft', 'exam_question_draft', 'feedback_draft', 'homework_help')),
  context         jsonb NOT NULL DEFAULT '{}'::jsonb,
  prompt_summary  text NOT NULL,
  response_summary text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_interactions_tenant_time ON ai.interactions (tenant_id, created_at DESC);
CREATE INDEX idx_ai_interactions_user ON ai.interactions (user_id, created_at DESC);

ALTER TABLE ai.interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai.interactions FORCE ROW LEVEL SECURITY;
CREATE POLICY ai_interactions_tenant ON ai.interactions
  TO elimubora_app
  USING (tenant_id = core.current_tenant_id())
  WITH CHECK (tenant_id = core.current_tenant_id());
GRANT SELECT, INSERT ON ai.interactions TO elimubora_app;
GRANT USAGE ON SEQUENCE ai.interactions_id_seq TO elimubora_app;

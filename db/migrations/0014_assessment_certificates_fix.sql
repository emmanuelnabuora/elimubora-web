-- ============================================================
-- 0014_assessment_certificates_fix.sql
--
-- Fixes a real bug found by integration testing: migration 0013
-- called core.make_syncable('assessment.certificates'), which
-- unconditionally creates triggers referencing `row_version` and
-- `updated_at` columns — but the certificates table was never given
-- those columns. Every write failed with "record new has no field
-- row_version" the moment the update-timestamp trigger fired.
--
-- Fix-forward rather than editing 0013: migrations are immutable
-- once applied (ADR-004). A fresh install applies 0013 (missing
-- columns) then this migration (adds them) in sequence and ends in
-- the same correct state as a database that already had 0013 applied.
-- ============================================================

ALTER TABLE assessment.certificates
  ADD COLUMN row_version bigint NOT NULL DEFAULT 1,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

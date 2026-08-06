-- 0022_logo_and_student_photo.sql
--
-- Adds image storage for two things requested together tonight:
-- school logos (on core.tenants) and student profile photos (on
-- sis.student_profiles). Both stored as data URLs directly in
-- Postgres (text column, no separate object storage) -- a
-- deliberate choice to avoid provisioning and wiring up a GCS bucket
-- right now. Application-level size limits keep these reasonable;
-- this isn't meant to hold arbitrarily large images.

ALTER TABLE core.tenants
  ADD COLUMN logo_data_url text;

ALTER TABLE sis.student_profiles
  ADD COLUMN photo_data_url text;

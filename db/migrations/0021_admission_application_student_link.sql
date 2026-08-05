-- 0021_admission_application_student_link.sql
--
-- Adds student_id to sis.admission_applications, so an admitted
-- application can record which real student it eventually became.
-- Without this there was no way to distinguish "admitted, not yet
-- enrolled" from "admitted and enrolled" -- both looked identical
-- (status = 'admitted') from the application's own perspective,
-- and the admin had no way to know which admitted candidates still
-- needed a real enrollment.

ALTER TABLE sis.admission_applications
  ADD COLUMN student_id uuid REFERENCES core.users(id);

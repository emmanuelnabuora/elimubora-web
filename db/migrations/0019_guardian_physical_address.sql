-- 0019_guardian_physical_address.sql
--
-- Adds physical_address to sis.guardians, needed for enrolling a
-- student and setting up their parent/guardian in one action (real
-- name, email, and physical address collected together at enrollment
-- time, not just the name/phone/email the guardian record already
-- supported).

ALTER TABLE sis.guardians ADD COLUMN physical_address text;

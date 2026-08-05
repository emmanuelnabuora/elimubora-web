-- 0020_student_address_emergency_contact.sql
--
-- Adds address and emergency contact fields to sis.student_profiles,
-- collected at enrollment time alongside the fields already there
-- (date_of_birth, gender). Emergency contact is a name AND a phone
-- number, not just a name -- a contact with no way to reach them
-- isn't useful in an actual emergency.

ALTER TABLE sis.student_profiles ADD COLUMN address text;
ALTER TABLE sis.student_profiles ADD COLUMN emergency_contact_name text;
ALTER TABLE sis.student_profiles ADD COLUMN emergency_contact_phone text;

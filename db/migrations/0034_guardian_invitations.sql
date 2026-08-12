-- 0034_guardian_invitations.sql
--
-- Today, linking a guardian who doesn't have a portal account yet
-- required an admin to somehow already know their userId --
-- PATCH /guardians/:id/link-account only works for an existing
-- account, and there was no way at all to invite someone new and
-- have that invitation itself establish the guardian link. This
-- makes the existing, generic invitation a carrier for that link:
-- these columns are null for every ordinary (teacher/admin/etc.)
-- invitation, and populated only when an admin invites someone
-- specifically as a student's guardian.
--
-- student_id references sis.student_profiles even though this table
-- lives in core -- cross-schema foreign keys are already the norm in
-- this database (e.g. sis.transfers -> core.tenants); the boundary
-- this codebase actually enforces is on TypeScript module imports,
-- not SQL schema references, which is why the *code* coordinating
-- this (identity's user creation plus sis's guardian linking) lives
-- in the composition layer rather than either module reaching into
-- the other directly.
--
-- permissions and is_emergency_contact carry a richer, per-relationship
-- access model than a single can_pickup flag alone: pickup authorization
-- is a real-world, physical permission (can this person collect the
-- child from school), genuinely different from digital access
-- permissions (can they view grades, pay fees online, receive
-- announcements) -- both are kept, not merged, since they answer
-- different questions. permissions defaults to a school-editable set
-- of six independent flags rather than a fixed boolean-per-column
-- schema, so new permission types can be added without another
-- migration.
ALTER TABLE core.invitations
  ADD COLUMN student_id          uuid REFERENCES sis.student_profiles(student_id),
  ADD COLUMN relationship        text,
  ADD COLUMN is_primary          boolean,
  ADD COLUMN can_pickup          boolean,
  ADD COLUMN is_emergency_contact boolean,
  ADD COLUMN permissions         jsonb;

-- The same richer permissions and emergency-contact flag need to
-- persist onto the actual relationship once an invitation is
-- accepted, not just live transiently on the invitation row.
ALTER TABLE sis.student_guardians
  ADD COLUMN is_emergency_contact boolean NOT NULL DEFAULT false,
  ADD COLUMN permissions jsonb NOT NULL DEFAULT '{
    "view_academics": true,
    "view_attendance": true,
    "receive_announcements": true,
    "view_finance": true,
    "pay_fees": true,
    "authorize_student_changes": false
  }'::jsonb;

-- auth_lookup_invitation's RETURNS TABLE shape can't be widened by
-- CREATE OR REPLACE alone (Postgres requires the same signature to
-- replace in place) -- drop and recreate with the new columns
-- included, since the pre-authentication accept flow needs to read
-- them before a tenant context (and therefore normal RLS access) is
-- available.
DROP FUNCTION core.auth_lookup_invitation(text);
CREATE FUNCTION core.auth_lookup_invitation(p_token_hash text)
RETURNS TABLE (id uuid, tenant_id uuid, email citext, role text,
               expires_at timestamptz, accepted_at timestamptz, revoked_at timestamptz,
               student_id uuid, relationship text, is_primary boolean, can_pickup boolean,
               is_emergency_contact boolean, permissions jsonb)
LANGUAGE sql SECURITY DEFINER SET search_path = core, pg_temp AS $$
  SELECT i.id, i.tenant_id, i.email, i.role, i.expires_at, i.accepted_at, i.revoked_at,
         i.student_id, i.relationship, i.is_primary, i.can_pickup,
         i.is_emergency_contact, i.permissions
    FROM core.invitations i
   WHERE i.token_hash = p_token_hash
$$;

ALTER FUNCTION core.auth_lookup_invitation(text) OWNER TO elimubora_auth;
REVOKE ALL ON FUNCTION core.auth_lookup_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.auth_lookup_invitation(text) TO elimubora_app;

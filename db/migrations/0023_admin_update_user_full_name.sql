-- 0023_admin_update_user_full_name.sql
--
-- core.users' RLS only ever permitted two things: a user updating
-- their own row (users_self), and tenant members being visible via
-- SELECT (users_tenant_members, read-only). There was never a policy
-- allowing a tenant admin to UPDATE a different user's row -- the new
-- "edit a teacher's display name" feature surfaced this gap directly:
-- the membership check passed, but the actual UPDATE silently
-- affected zero rows, since RLS blocked it before it could touch
-- anything.
--
-- Deliberately not fixed with a broader RLS policy matching
-- core.memberships' tenant-wide ALL policy -- core.users also holds
-- password_hash and email, and a policy permissive enough to allow
-- full_name updates would just as easily permit an admin to overwrite
-- another user's password hash or email directly, which is a real
-- account-takeover path, not a hypothetical one.
--
-- Instead: a single-purpose SECURITY DEFINER function, matching the
-- existing pattern this schema already uses for exactly this kind of
-- narrow, privileged operation (auth_set_password, etc.) -- it can
-- only ever change full_name, nothing else. The actual authorization
-- check (does the caller's tenant have an active membership for this
-- user) stays in application code, where it was already correct and
-- already tested -- this function does no authorization of its own,
-- by design, the same way auth_set_password doesn't either.

CREATE OR REPLACE FUNCTION core.admin_update_user_full_name(p_user_id uuid, p_full_name text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = core, pg_temp AS $$
  UPDATE core.users SET full_name = p_full_name WHERE id = p_user_id AND deleted_at IS NULL
  RETURNING true
$$;

ALTER FUNCTION core.admin_update_user_full_name(uuid, text) OWNER TO elimubora_auth;
REVOKE ALL ON FUNCTION core.admin_update_user_full_name(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.admin_update_user_full_name(uuid, text) TO elimubora_app;

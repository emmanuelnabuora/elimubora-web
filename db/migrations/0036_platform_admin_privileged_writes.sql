-- 0036_platform_admin_privileged_writes.sql
--
-- PlatformAdminService.deleteUser / deleteInstitution need two
-- privileged operations that elimubora_app's ordinary RLS policies
-- don't permit, discovered by the integration tests for this feature
-- actually failing against real RLS rather than by inspection:
--
-- 1. Updating an ARBITRARY user's core.users row. The only UPDATE
--    policy on core.users is `users_self` (id = current_actor_id()) --
--    there has never been a policy letting one user's session modify
--    another user's row, platform_admin or not. (users_tenant_members
--    only grants SELECT, and even that only within the actor's own
--    bound tenant -- irrelevant here since platform_admin typically
--    acts from the platform tenant while deleting a user who belongs
--    to some school tenant entirely.)
--
-- 2. Reading core.memberships for a tenant OTHER than the actor's own
--    bound tenant, to find every user who needs their sessions
--    revoked when that tenant is deleted. `memberships_tenant`
--    restricts elimubora_app to `tenant_id = current_tenant_id()` --
--    the acting platform_admin's own tenant, not the tenant being
--    deleted.
--
-- Both follow the exact precedent core.platform_stats() (0026) set:
-- a narrow SECURITY DEFINER function, owned by elimubora_auth (which
-- 0003 and 0026 already gave the necessary grants and permissive
-- policies to -- see users_auth_all and memberships_auth_read), doing
-- no authorization of its own. The platform_admin-only check stays in
-- PlatformAdminService, in application code that's covered by tests
-- and easy to audit -- not buried in a database function. Everything
-- these functions DON'T strictly need elevated privilege for
-- (core.refresh_tokens has no RLS at all; core.tenants has none
-- either, being the root directory table) stays as ordinary
-- elimubora_app-privileged SQL in the repository, keeping each
-- function's footprint as small as possible.
--
-- No new GRANTs or policies needed -- elimubora_auth already has
-- everything both function bodies touch.

CREATE OR REPLACE FUNCTION core.platform_delete_user(target_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, pg_temp AS $$
DECLARE
  found jsonb;
BEGIN
  SELECT jsonb_build_object('id', id, 'fullName', full_name)
    INTO found
    FROM core.users
   WHERE id = target_user_id AND deleted_at IS NULL
   FOR UPDATE;

  IF found IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE core.users SET status = 'suspended', deleted_at = now() WHERE id = target_user_id;

  RETURN found;
END;
$$;

ALTER FUNCTION core.platform_delete_user(uuid) OWNER TO elimubora_auth;
REVOKE ALL ON FUNCTION core.platform_delete_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.platform_delete_user(uuid) TO elimubora_app;

-- Returns every user_id with a non-deleted membership in the given
-- tenant, so the caller can revoke their refresh tokens (an ordinary
-- elimubora_app UPDATE -- core.refresh_tokens has no RLS) without
-- needing to read core.memberships across tenants itself.
CREATE OR REPLACE FUNCTION core.platform_tenant_member_ids(target_tenant_id uuid)
RETURNS uuid[] LANGUAGE sql SECURITY DEFINER SET search_path = core, pg_temp AS $$
  SELECT coalesce(array_agg(DISTINCT user_id), ARRAY[]::uuid[])
    FROM core.memberships
   WHERE tenant_id = target_tenant_id AND deleted_at IS NULL
$$;

ALTER FUNCTION core.platform_tenant_member_ids(uuid) OWNER TO elimubora_auth;
REVOKE ALL ON FUNCTION core.platform_tenant_member_ids(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.platform_tenant_member_ids(uuid) TO elimubora_app;

-- 0026_platform_stats.sql
--
-- No cross-tenant statistics capability existed at all -- the only
-- way to see platform-wide numbers tonight was hand-written SQL run
-- directly against the database, and even that required temporarily
-- lifting FORCE ROW LEVEL SECURITY on core.memberships (it blocks
-- even the table owner without an active tenant context set, by
-- design). That's a reasonable one-off diagnostic move; it is not
-- something a real feature should ever do on a live request.
--
-- Instead: a single, narrow SECURITY DEFINER function returning only
-- aggregate counts -- total/activated users, a per-role breakdown,
-- and a per-tenant breakdown by name and user count. It deliberately
-- never returns individual user rows, emails, or any other PII --
-- the whole point is that a platform_admin gets real cross-school
-- visibility without this becoming a general-purpose way to read
-- other schools' data. The function itself does no authorization of
-- its own (same as every other SECURITY DEFINER function in this
-- schema, e.g. admin_update_user_full_name) -- the platform_admin-only
-- check belongs in and stays in application code, which is easy to
-- audit and already covered by tests, unlike authorization logic
-- buried inside a database function.

CREATE OR REPLACE FUNCTION core.platform_stats()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = core, pg_temp AS $$
  SELECT jsonb_build_object(
    'totalUsers', (SELECT count(*) FROM core.users),
    'activatedUsers', (
      SELECT count(*) FROM core.users
      WHERE email NOT LIKE 'shadow.%@no-login.elimubora.internal'
    ),
    'totalSchools', (SELECT count(*) FROM core.tenants WHERE kind = 'school'),
    'byRole', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('role', role, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
      FROM (
        SELECT role, count(DISTINCT user_id) AS cnt
        FROM core.memberships
        WHERE deleted_at IS NULL
        GROUP BY role
      ) r
    ),
    'byTenant', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('tenantId', id, 'tenantName', name, 'tenantKind', kind, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
      FROM (
        SELECT t.id, t.name, t.kind, count(DISTINCT m.user_id) AS cnt
        FROM core.memberships m
        JOIN core.tenants t ON t.id = m.tenant_id
        WHERE m.deleted_at IS NULL
        GROUP BY t.id, t.name, t.kind
      ) tt
    )
  )
$$;

ALTER FUNCTION core.platform_stats() OWNER TO elimubora_auth;
REVOKE ALL ON FUNCTION core.platform_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.platform_stats() TO elimubora_app;

-- elimubora_auth previously only ever needed core.users and
-- core.invitations for the existing auth_* functions -- this is the
-- first SECURITY DEFINER function in this schema that also needs to
-- read core.tenants and core.memberships. SECURITY DEFINER functions
-- run with the *owner's* privileges, not the caller's, so without
-- these grants the function itself fails with "permission denied"
-- regardless of what the calling role (elimubora_app) can see.
GRANT SELECT ON core.tenants TO elimubora_auth;
GRANT SELECT ON core.memberships TO elimubora_auth;

-- The grant alone isn't sufficient for core.memberships: it has
-- FORCE ROW LEVEL SECURITY, which applies to every role that isn't
-- the table owner (elimubora), regardless of grants. Rather than the
-- broader BYPASSRLS role attribute -- which would bypass RLS for
-- elimubora_auth on every table it can ever access, including future
-- ones -- this follows the exact existing convention in this schema
-- (see core.users and core.invitations above): a narrow, table-specific
-- permissive policy scoped only to this one role and this one table.
-- core.tenants needs no equivalent policy -- it has no RLS enabled at
-- all (relrowsecurity is false), by original design, since it's the
-- root directory table other tenant-scoped policies themselves join
-- against.
CREATE POLICY memberships_auth_read ON core.memberships FOR SELECT
  TO elimubora_auth USING (true);

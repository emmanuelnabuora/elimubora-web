-- 0032_platform_audit_log_policy.sql
--
-- The new platform-admin modules (business, intelligence, command)
-- write audit entries for genuinely platform-wide actions -- creating
-- an incident, approving a restore, publishing a national broadcast --
-- none of which belong to any single tenant. They use
-- DatabaseService.query(), the existing "untenanted query, for global
-- tables" method (see database.service.ts), so no app.tenant_id is
-- ever set for these connections.
--
-- Found live, not by inspection: the very first real end-to-end test
-- of a fixed platform_admin endpoint failed with "new row violates
-- row-level security policy for table audit_log". The existing
-- audit_tenant_isolation policy requires tenant_id = current_tenant_id()
-- on insert -- with no tenant context set, that's never satisfiable.
--
-- This adds a second, additional permissive policy (RLS policies for
-- the same command/role combine with OR) allowing elimubora_app to
-- insert audit rows with tenant_id explicitly NULL. It does not
-- relax the existing tenant-scoped policy at all -- a normal,
-- tenant-scoped audit insert still must match the caller's own
-- tenant exactly. This only opens a narrow, explicit door for the
-- one case the schema's own nullable tenant_id column already
-- anticipated: platform-level actions with no tenant to bind.
CREATE POLICY audit_platform_insert ON core.audit_log
  FOR INSERT
  TO elimubora_app
  WITH CHECK (tenant_id IS NULL);

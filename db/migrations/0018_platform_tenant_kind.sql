-- 0018_platform_tenant_kind.sql
--
-- Adds 'platform' as a valid core.tenants.kind value: ElimuBora's own
-- internal operator tenant, home to platform_admin memberships. This
-- role has existed in the MEMBERSHIP_ROLES type since Sprint 2 but had
-- no tenant it could actually belong to -- core.memberships.tenant_id
-- is NOT NULL (every membership, including a platform-wide admin,
-- must reference a real tenant row), and no 'platform' kind existed
-- to create one. A single such tenant is created once via
-- tools/bootstrap-platform-admin.mjs, not through this migration --
-- this migration only makes the kind value legal.

ALTER TABLE core.tenants DROP CONSTRAINT tenants_kind_check;
ALTER TABLE core.tenants ADD CONSTRAINT tenants_kind_check
  CHECK (kind IN ('school','county','university','tvet','ministry','partner','platform'));

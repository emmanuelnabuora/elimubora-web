-- 0035_school_applications.sql
--
-- Self-serve school onboarding: a school submits an application
-- publicly, a platform_admin reviews and approves or rejects it, and
-- only on approval does a real tenant + admin invitation get created.
-- Today POST /v1/tenants (tenant-provisioning.controller.ts) is
-- @Roles('platform_admin')-only and provisions a tenant, its admin
-- user, and its login credentials all in one synchronous call --
-- effectively an internal ops tool for staff onboarding a school on
-- the school's behalf, not something a school can do itself. This
-- table is the holding area in front of that gate: applications live
-- and get reviewed here, and nothing in core.tenants or core.users
-- is touched until a platform_admin approves one.
--
-- Deliberately global -- no RLS, same as core.tenants itself (see
-- 0001_foundation.sql: "global table -- no RLS; access mediated by
-- the API"). An application has no tenant_id to isolate by: it
-- predates the tenant it may become, and it's not owned by any
-- tenant even conceptually the way school-scoped data is. Public
-- submission and status-check both use DatabaseService.query() (the
-- existing "untenanted query, for global tables" method), with no
-- app.tenant_id ever bound for either -- there is nothing to bind.
-- Review/approve/reject are restricted to platform_admin in
-- application code via @Roles(), matching how every other
-- platform-wide, non-tenant-scoped operation in this codebase is
-- authorized (getPlatformStats, core.platform_stats() -- see the
-- comment on TenantProvisioningService.getPlatformStats: "the
-- underlying database function does no authorization of its own by
-- design, matching how every other SECURITY DEFINER function in this
-- schema works"). Enabling RLS here with an always-true policy would
-- add no real isolation over that -- it would just formally satisfy
-- "RLS is on" while protecting nothing, since there is no tenant
-- predicate to check. Flagging this explicitly rather than
-- papering over it: it's a deliberate, precedented exception to the
-- RLS-on-every-table rule, not an oversight.
--
-- status_token_hash lets an applicant check status without an
-- account -- same shape as core.invitations.token_hash, hashed the
-- same way (TokenService.hashRefreshToken) before it ever reaches
-- SQL, so a stolen application row never exposes a usable secret.
--
-- resulting_tenant_id is set on approval, once core.tenants actually
-- has the row it points to. It's nullable and only ever populated
-- after the fact -- never referenced during the approval transaction
-- itself, so no ordering dependency between the two inserts is
-- created by the FK.
CREATE TABLE core.school_applications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'approved', 'rejected')),

  school_name         text NOT NULL,
  county_code         text,
  sub_county          text,
  ward                text,
  physical_address    text,

  short_name          text,
  registration_number text,
  education_level     text,
  ownership           text,
  year_established    text,
  motto               text,

  admin_full_name     text NOT NULL,
  admin_email         citext NOT NULL,
  admin_phone         text,

  contacts            jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Same "genuinely functional, not just record-keeping" fields as
  -- CreateTenantDto: when all three are present, approval creates a
  -- real class stream per grade x stream combination, same as the
  -- platform_admin-run wizard already does.
  academic_year       integer,
  grade_levels        text[],
  streams             text[],

  notes               text,

  status_token_hash   text NOT NULL UNIQUE,

  submitted_at        timestamptz NOT NULL DEFAULT now(),
  reviewed_at         timestamptz,
  reviewed_by         uuid REFERENCES core.users(id),
  rejection_reason    text,
  resulting_tenant_id uuid REFERENCES core.tenants(id),

  CONSTRAINT school_applications_review_consistency CHECK (
    (status = 'pending'  AND reviewed_at IS NULL     AND resulting_tenant_id IS NULL) OR
    (status = 'approved' AND reviewed_at IS NOT NULL AND resulting_tenant_id IS NOT NULL) OR
    (status = 'rejected' AND reviewed_at IS NOT NULL AND resulting_tenant_id IS NULL)
  )
);

-- Admin review list is filtered by status first, most-recent-first
-- within it -- e.g. "show me everything still pending".
CREATE INDEX school_applications_status_idx ON core.school_applications (status, submitted_at DESC);

-- No DELETE grant, matching every other durable record table in this
-- schema (invitations, audit_log) -- a rejected application stays as
-- a record, it doesn't disappear.
GRANT SELECT, INSERT, UPDATE ON core.school_applications TO elimubora_app;

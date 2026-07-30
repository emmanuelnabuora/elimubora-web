# ADR-008: SIS provisioning, cross-tenant RLS, and the composition layer

Status: Accepted · Date: 2026-07-29

## Context

Sprint 5 (SIS) needed to create system identities for students without
importing the identity module. Sprints 6–7 (Teacher/Parent Portal) need
to compose reads across Learning, SIS, and Teacher Portal data for
dashboards — the module-boundary rule ("modules never import each
other") correctly forbids this too.

## Decisions

**1. Core-owned provisioning port.** `core/identity/user-provisioning.service.ts`
creates a bare `core.users` + `core.memberships` pair (a "shadow"
account: real random password, never issued; placeholder email) for
system identities that must exist before or without the person ever
logging in — the common case for CBC learners in PP1–G3. This
mirrors the sync-handler self-registration pattern from ADR-007: core
defines a narrow primitive, any domain module (SIS today, a future
bulk staff import) consumes it directly, with zero domain module
importing another. `PasswordService` moved from the identity module
into `core/auth/` to make this possible, since hashing is a core
platform concern, not identity-specific business logic.

**2. Cross-tenant RLS via an explicit two-sided policy.** `sis.transfers`
is the platform's first table where a single `tenant_id` column is
wrong: a transfer must be visible to both the sending and receiving
school. The policy is `current_tenant_id() IN (from_tenant_id,
to_tenant_id)` rather than a definer-function workaround. Writes use
`DatabaseService.withContext` with an explicit tenant (source tenant
when requesting, receiving tenant when deciding) rather than the
ambient request tenant, since the two parties to a transfer are, by
definition, different tenants than whichever one is acting.

**3. Medical data lives in its own table, not just behind a role check.**
`sis.student_medical` is physically separate from `sis.student_profiles`
and deliberately excluded from `core.make_syncable` — it never enters
the change-log pull feed, so it can never be cached on a device. The
service-layer role gate (`school_admin`/`principal`/`platform_admin`
only, narrower than general admin actions) is defense in depth on top
of that physical separation, not a substitute for it.

**4. The composition layer: a bounded, one-way exception to the module
boundary.** Teacher and Parent Portal dashboards are pure read
aggregation across other modules' data — genuinely different from a
domain module owning a bounded context. `apps/api/src/composition/`
is introduced as an explicit architectural layer that MAY import
multiple domain modules' repositories for reads. A new
dependency-cruiser rule (`modules-cannot-import-composition`) makes
the exception one-directional and enforced: composition depends on
modules, never the reverse, so it cannot become a hidden coupling
between domain modules. Composition-layer code is convention-bound to
reads only — repositories it calls are the same ones domain modules
use for their own writes, so nothing new is exposed, only recomposed.

## Consequences

- Every future "portal" or "dashboard" surface (Government Dashboard
  in Sprint 13, Analytics in Sprint 14) belongs in `composition/`, not
  as a new domain module with its own bounded context.
- `sis.transfers`' two-sided RLS pattern is the template for any
  future genuinely cross-tenant record (e.g., a shared TVET/university
  articulation record) — the answer is a policy expressing "either
  side," not a `SECURITY DEFINER` bypass.

## Testing notes

The SIS integration suite hit the FORCE-RLS-blocks-the-owner lesson
(ADR-006, ADR-007) a third time — this time in the test's own
fixture-reading code, not the application. It's now a reflex: any
direct Postgres read in a test must go through the app role with a
bound tenant context, never the migration-owner connection.

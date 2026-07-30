# ADR-009: Sprints 6–10 — conflict classes, DB-enforced constraints, and the Kenya payment boundary

Status: Accepted · Date: 2026-07-29

## Decisions

**1. Last-write-wins as a first-class conflict class (Sprint 6).**
Attendance is the platform's second offline-write entity after
Sprint 4's submissions, and deliberately the opposite conflict class:
`ON CONFLICT (class_stream_id, learner_id, attendance_date) DO UPDATE`
with an unconditional overwrite — no version check, no merge, no
surfaced conflict. Whichever mutation the server applies last for a
given student/day simply wins. This is correct behavior, not a
shortcut: a teaching assistant's correction should override an
earlier entry outright, the same way it would on paper. Submissions
(create-only, first-write-wins via a unique constraint) and
attendance (last-write-wins via unconditional overwrite) are now both
concretely implemented, giving every future syncable entity two
worked examples to choose between.

**2. The composition layer, formalized (Sprint 6–7).**
`apps/api/src/composition/` is a new architectural layer, permitted to
import multiple domain modules' repositories for read aggregation —
Teacher Dashboard and Parent Portal both need this. A dedicated
dependency-cruiser rule (`modules-cannot-import-composition`) makes
the exception one-directional: composition depends on modules, modules
never depend on composition, so it can't become a hidden coupling
channel between domain modules. Every future dashboard-style surface
(Government Dashboard, Analytics) belongs here, not as its own
bounded-context module.

**3. Database-enforced scheduling conflicts (Sprint 8).**
Timetable conflict prevention uses three Postgres `EXCLUDE` constraints
(teacher, room, class stream — each keyed on tenant + academic year +
day + an `int4range` of minutes-since-midnight, requiring
`btree_gist`) rather than an application-layer overlap check. This
guarantee holds even against code paths that don't yet exist — a
future bulk timetable importer, a bug in some other service — because
it's enforced at the point of writing the row, not by trusting every
caller to check first. `FinanceRepository`-style pattern: catch the
specific Postgres error code (`23P01 exclusion_violation`) and
translate it to a friendly `409`, never a raw `500`.

**4. M-Pesa sits behind a real adapter boundary, honestly implemented
(Sprint 9).** `PaymentGateway` is the port; `ManualReconciliationGateway`
is the only implementation, and it makes no network call — it
generates a local pending reference and waits for explicit
confirmation, matching the platform's founding principle that M-Pesa
payments are treated as hints and reconciliation is the source of
truth. This is a deliberate choice not to fabricate a working Safaricom
integration in an environment with no real Daraja credentials. A
production adapter implementing the same `initiate()` contract is a
provider swap in `CoreModule`, not an application-code change.

**5. Invoice balances are always derived, never trusted from a client
(Sprint 9).** `amount_paid` and `status` are recomputed from
`SUM(payments WHERE status = 'confirmed')` on every payment state
change — there is exactly one code path that writes them
(`recomputeInvoiceBalance`). A duplicate payment reference is rejected
at the database level (`UNIQUE(method, reference)`), not just checked
in application code.

## The most important lesson this batch: SECURITY DEFINER does not bypass RLS

Migration 0010 gave `elimubora_finance` a table-level `GRANT SELECT`
on `finance.payments` and made `lookup_pending_mpesa_payment` `SECURITY
DEFINER`, expecting that combination to let the M-Pesa webhook — which
arrives with no tenant context — find a pending payment. It didn't:
the function returned zero rows for a payment that demonstrably
existed and was committed.

`SECURITY DEFINER` changes which SQL *privileges* apply (so a narrowly
scoped role can touch a table it wouldn't otherwise reach) — it does
**not** exempt that role from Row-Level Security. Under `FORCE ROW
LEVEL SECURITY`, a role with no matching *permissive policy* sees zero
rows, full stop, regardless of table-level grants or the function's
security context. Migration 0003 already had this right for identity
(`users_auth_all ON core.users TO elimubora_auth USING (true)`) but
migration 0010 didn't replicate it for finance. Migration 0011 is the
fix: an explicit `USING (true)` policy scoped to `elimubora_finance`.

The template going forward, for any future `SECURITY DEFINER` lookup
function on an RLS-protected table: the definer role needs **both** a
table-level grant **and** a permissive RLS policy naming that role.
One without the other fails silently — no error, just an empty result
— which is exactly why this shipped once already and was only caught
by an integration test that exercised the real webhook path rather
than inspecting the code.

## Consequences

- Every "narrow pre-context lookup" pattern (pre-auth in Sprint 3,
  cross-tenant transfer visibility in Sprint 5, gateway callbacks in
  Sprint 9) now has a consistent, documented recipe: definer role,
  fixed `search_path`, table grant, **and** a permissive RLS policy —
  all four, not three.
- The full migration chain (0001–0012) applies cleanly from empty and
  is idempotent on replay, verified end-to-end in this sprint batch.

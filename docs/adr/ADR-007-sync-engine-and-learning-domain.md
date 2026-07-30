# ADR-007: Sync engine architecture and the CBC learning domain

Status: Accepted · Date: 2026-07-29

## Context

ADR-003 committed the platform to offline-first as a data-model
constraint. Sprint 4 (Learning Platform) is where that commitment
becomes running code: submissions are the first entity a learner may
create while offline for days.

## Decisions

**1. Pull side: a trigger-maintained change log, not application-level
event sourcing.** Every syncable table gets three triggers (via
`learning.make_syncable`, a one-time migration helper): bump the row's
version, log the change, and enforce RLS. A module's write path cannot
forget to make itself syncable — the database does it. Clients pull
`WHERE seq > cursor`, paginated at 500 rows.

**2. Visibility delay is a real safety mechanism, not a magic number.**
`core.change_log.seq` is a single global sequence. A transaction that
acquires a lower `seq` can still commit *after* a transaction with a
higher `seq`, because sequence allocation and commit order aren't the
same thing under concurrent writers. A client that pulled the higher
`seq` first could permanently miss the lower one. Serving only rows
older than `SYNC_VISIBILITY_DELAY_SECONDS` (default 2s, env-configurable)
bounds this out-of-order commit window at the cost of that much sync
latency — a trade the offline-first thesis (minutes/hours of staleness
already tolerated) makes easy. This is exactly the kind of thing that
looks like test flakiness until you understand why it's there: our own
integration test initially failed for writes it made milliseconds
earlier, which is the mechanism working, not a bug — see the "Testing
notes" section below.

**3. Push side: client-generated mutation IDs are the idempotency key,
domain uniqueness is the second line of defense.** `core.applied_mutations`
records the mutation ID and its result the first time a handler runs; a
replay returns the stored result without re-executing. For submissions
specifically, the UNIQUE constraint on `(assignment_id, learner_id)`
means even a *different* mutation ID for an already-answered assignment
is absorbed as a no-op rather than erroring — "first submission wins"
matches how a classroom actually works.

**4. Handlers register themselves; core never imports a domain module.**
`SyncService.registerHandler()` is called from each handler's own
`OnModuleInit`. This was a deliberate correction mid-sprint: the first
draft tried to inject an array of handlers into `SyncService`'s
constructor via a shared token, which does not work as a Nest
multi-provider (Nest has no built-in multi-binding for arbitrary
tokens, unlike `APP_GUARD`/`APP_INTERCEPTOR`). The registration-callback
pattern keeps `SyncService` in `core/` with zero compile-time dependency
on `modules/learning`, preserving the modular-monolith boundary that
`.dependency-cruiser.cjs` enforces.

**5. Grading is never a sync mutation.** Submissions are learner-authored
and offline-capable; scores, rubric levels and feedback are
teacher-authored and server-authoritative (ADR-003's conflict-class
distinction, made concrete). `SubmissionSyncHandler` only ever inserts;
`gradeSubmission` is reachable exclusively through the authenticated
`PATCH /submissions/:id/grade` endpoint.

**6. Two authorization layers, doing different jobs.** RLS (database)
guarantees a query cannot return another tenant's rows, full stop.
`LearningService` (application) additionally checks role and
enrollment — a genuine member of the right tenant still needs to
*teach this specific course* to modify it, or be enrolled as its
*learner* to submit to it. Coarse, tenant-wide RBAC (identity module's
admin endpoints) uses the `@Roles()` decorator; fine-grained,
data-dependent authorization (does this teacher teach this course) is
necessarily a service-layer lookup and is written out explicitly in
`LearningService` rather than hidden in a decorator.

## Consequences

- Any future syncable module (Assessment, SIS attendance, Finance
  read-models) reuses `learning.make_syncable` and the same
  `MutationHandler` contract without touching `SyncService`.
- The visibility delay is a per-environment tuning knob
  (`SYNC_VISIBILITY_DELAY_SECONDS`), not a recompile.
- Competency records (CBC strand/sub-strand content) are curriculum
  data, not user-generated; a KICD import pipeline is out of this
  sprint's scope and is seeded manually until then.

## Testing notes

Running the full integration suite surfaced two real issues, both now
fixed and covered by a regression test:

1. **The visibility delay initially made the pull test flaky-looking.**
   The test wrote several rows and immediately pulled — precisely the
   window the delay exists to protect. The fix wasn't to weaken the
   mechanism; it was to make the delay configurable and add a dedicated
   test that sets it to a large value and asserts recent writes are
   correctly withheld, alongside the default-config test that (after a
   short, real delay already elapsed by the time later assertions ran)
   confirms they eventually appear.
2. **Seeding test fixtures through the admin/owner connection failed
   under `FORCE ROW LEVEL SECURITY`** — the same lesson as ADR-006,
   now hit a second time on a different table. Fixture data must be
   inserted through the app role with a bound tenant context, never
   through the migration-owner connection.

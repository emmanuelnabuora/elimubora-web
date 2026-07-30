# ADR-012: Sprint 13 -- Government Dashboard, the first cross-tenant read path

Status: Accepted · Date: 2026-07-30

## Context

Every prior aggregation (Teacher Dashboard, Parent Portal, Sprint 7-9)
reads within one tenant's RLS context. A ministry official asking "what
is national enrollment?" fundamentally cannot be answered that way --
the answer spans every school. This sprint is the first to genuinely
need cross-tenant reads in a live request path.

## Decisions

**1. A refreshed snapshot layer, not a live cross-tenant query per
request.** `gov.enrollment_snapshots` / `gov.attendance_snapshots`
carry no `tenant_id` at all -- they are already-aggregate data (counts,
rates) with no individual tenant or student identity to protect via
RLS. A ministry-triggered refresh computes them via the WORKER role;
ordinary reads are plain, tenant-less SELECTs through the app role.
This is the standard real-world pattern for this kind of dashboard
(a warehouse/rollup layer, refreshed periodically) rather than
bypassing RLS on every page load.

**2. WorkerDatabaseService -- a new, reusable core primitive.** A
second connection pool authenticated as `elimubora_worker`, living in
`core/database/` alongside `DatabaseService`. This is the first time
anything *other than* OutboxRelay has used the worker role's
cross-tenant read policies (`USING (true)`, established all the way
back in ADR-002) from within a live HTTP request. The class comment is
explicit about the boundary: this must never serve an ordinary
request's own data, only background/admin-triggered aggregation.
Sprint 14 (Analytics) will need the identical capability.

**3. Authorization is role- and county-scoped against the requester's
own tenant, not RLS.** A county_officer's tenant (kind='county',
county_code -- both modeled since Sprint 1) bounds every query they
can make; the service resolves this from their own tenant record and
ignores any county they might pass in the query string.
ministry_official/platform_admin may request any county or the
national rollup. Only ministry_official/platform_admin may trigger a
refresh -- a county officer publishing "current" national statistics
would be the wrong trust boundary.

## Three real bugs, caught by actually running the integration test

**A pre-existing test-harness gap, four sprints old.** Every
integration test since Sprint 4 has set workerDatabaseUrl to the
*app* role's connection string, not the worker role's. It never
mattered, because OutboxRelay -- the only prior consumer -- touches
that connection asynchronously on a 60-second poll that never fires
within a short-lived test. Government Dashboard's refresh is the first
feature to use the worker connection synchronously and immediately,
and it surfaced the mistake instantly as a permission-denied error
against a table that, on inspection, had entirely correct grants. The
lesson: a config value can be silently wrong for a long time if
nothing actually forces it to matter.

**A genuine Postgres parameter-type-inference conflict.** The
attendance refresh query used the same $1 both as the academic_year
value being inserted (implying int) and inside
`extract(year FROM ar.attendance_date) = $1` (which returns double
precision) -- Postgres refuses to unify one placeholder to two
different inferred types ("inconsistent types deduced for parameter
$1"). Fixed with explicit ::int casts at both sites. Worth
remembering for any future query reusing one placeholder across an
INSERT target and a WHERE/extract() comparison.

**A wrong test assumption, not an app bug.** A county whose one school
has zero enrolled students still produces a real snapshot row (0
students, 1 school) via the LEFT JOIN -- the test originally expected
a 404, conflating "no data yet" with "the county has no schools at
all," which are genuinely different, worth-distinguishing facts. Fixed
the test's expectation, not the query.

**A test-isolation lesson specific to cross-tenant aggregates.**
Every prior sprint's tests were naturally isolated from each other by
RLS -- one tenant's created data was invisible to another's queries.
A *global* aggregate has no such natural isolation: this sprint's test
had to (a) generate county codes unique per run so they can never
collide with any other test's historical data in the same shared dev
database, and (b) assert national totals with toBeGreaterThanOrEqual
rather than exact equality, since "national" genuinely includes every
other test that ever ran. This is a durable pattern for any future
test of a genuinely cross-tenant read.

## Consequences

- WorkerDatabaseService is now available for Sprint 14 (Analytics)
  to reuse directly -- no new cross-tenant-reader infrastructure
  should be needed there.
- Teacher Distribution, Infrastructure, Funding, School Performance,
  Policy Monitoring, Inspection Reports, and an Early Warning System
  all follow the identical snapshot-table + worker-role-refresh +
  county-scoped-read pattern established here.
- Any future integration test needing the worker role must set
  workerDatabaseUrl to real elimubora_worker credentials explicitly --
  the wrong-but-silent default should be treated as a known trap, not
  copied forward.

# ADR-013: Sprint 14 -- Analytics, the mirror image of Government Dashboard

Status: Accepted · Date: 2026-07-31

## Context

Sprint 13 built cross-tenant government analytics via a refreshed
snapshot layer, because RLS fundamentally cannot help across tenants.
Sprint 14's Analytics is single-school: a principal wants to see
*their own* course completion rates, teacher grading backlogs, fee
collection, and at-risk learners -- everything within one tenant's RLS
boundary. This is architecturally the opposite case, and the sprint's
main value is making that contrast explicit and reusable.

## Decisions

**1. Pure composition, zero new tables.** Unlike Government Dashboard,
Analytics needed no migration at all. Every metric is a live query
within the requester's own tenant, computed on demand by adding a
handful of aggregate methods to the OWNING modules' repositories
(Learning, Finance, Teacher Portal) -- the same pattern Teacher
Dashboard (Sprint 6) established for countPendingGradingForCourse.
AnalyticsController lives in composition/ per ADR-008 and depends on
nothing composition wasn't already importing.

**2. When to snapshot vs. when to compute live -- now a documented
choice, not a one-off judgment call.** Government Dashboard (ADR-012)
needed a refresh-and-store snapshot layer specifically because a
national/county rollup crosses RLS boundaries that only the worker
role can read. Analytics needs no such thing because everything stays
inside one tenant's own RLS-scoped transaction at ordinary school
scale. The class doc on AnalyticsController states this explicitly:
if a future deployment's per-tenant data volume made live computation
too slow, the natural evolution is the identical snapshot pattern, not
a different architecture.

**3. "Predictive Analytics" is a rule-based Early Warning indicator,
not a claimed ML model.** Fixed thresholds -- attendance rate below
75%, average graded score below 50 -- computed live per learner, each
flagged reason explicit and explainable. This continues the sandbox-
honesty precedent from the AI Platform (ADR-011) and Finance's M-Pesa
integration: this codebase has no ML infrastructure and no training
data, and claiming a predictive model without either would be
dishonest regardless of how plausible the output looked. A minimum-
data safeguard (5+ recorded attendance days before judging attendance)
prevents flagging a learner on day three of term for a handful of
early absences -- verified directly: a learner with only 2 recorded
(both absent) days is NOT flagged despite a 0% raw rate, because there
isn't yet enough data to judge.

## Two real bugs, both in the test's own setup, not the application

**Authorization correctly rejected an invalid test shortcut.** The
test's beforeAll originally had the school admin submit an assignment
"on behalf of" a learner for setup convenience -- LearningService.submit
(Sprint 4) correctly requires the submitter be enrolled as a learner
themselves, and rejected it with 403, cascading to fail every test in
the file (a thrown beforeAll fails the whole describe block in Jest,
reporting the same stack trace against every test). No submit-on-behalf
capability exists in this codebase, nor should one -- exactly the
authorization boundary working as designed.

**Shadow accounts cannot log in, by design.** The fix above initially
tried to have one of the SIS-provisioned test learners submit for
themselves -- but students provisioned via UserProvisioningService
(Sprint 5) get an intentionally unusable random password precisely
because most CBC learners never authenticate directly. The working fix
uses a separately, normally-registered learner purely to produce the
ungraded submission the grading-backlog test needs, decoupled entirely
from the SIS-provisioned learners used for the Early Warning assertions.

## Consequences

- Teacher Distribution, Infrastructure, and School Performance
  analytics (all still-deferred items from the original brief) follow
  this same live-composition pattern at the tenant level -- no new
  migrations needed for any of them either.
- The snapshot-vs-live decision now has a one-sentence test any future
  sprint can apply: does this read need to cross tenant/RLS
  boundaries? If yes, Sprint 13's pattern. If no, Sprint 14's.

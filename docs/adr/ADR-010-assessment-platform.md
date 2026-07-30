# ADR-010: Sprint 11 — Assessment Platform

Status: Accepted · Date: 2026-07-30

## Decisions

**1. Exam content is deliberately excluded from the sync/pull feed.**
`question_banks`, `questions`, and `exams` do not go through
`core.make_syncable`. Every prior exclusion (`student_medical`,
Sprint 5) was for privacy; this is the first exclusion for a
different reason — integrity. If exam questions entered the general
change-log pull feed, any client with tenant access could download
the full bank before sitting the exam, and Postgres's own
`ORDER BY random()` selection would be worthless against a device that
already has every question cached locally. `exam_attempts` is
likewise a plain online-only table with no push handler: exams are a
supervised, connected activity by design (the brief's "Secure
Browser" requirement points the same direction), not an offline one.

**2. Randomization happens in Postgres, and the draw is frozen.**
`ORDER BY random() LIMIT n` selects the question set at attempt-start
time; the chosen ids are written onto the attempt row immediately and
never recomputed. Grading, review, and the learner's in-progress view
all reference this frozen list — a question bank edit after a learner
has started never changes what they're actually being examined on.

**3. The answer key never reaches a learner.** `stripAnswerKey` in
`AssessmentService` is the only place `correctOptionId` is removed
before a learner-facing response; auto-grading (comparing submitted
answers against the key) happens entirely server-side, and is the
only code path that ever reads the key at all.

**4. MCQ auto-grading and manual grading are two honest paths, not one
disguised as the other.** Submission immediately computes `auto_score`
from MCQ answers; `manual_score` starts at zero and the attempt stays
`submitted` (not `graded`) until a human grader acts. AI-assisted
marking (the brief's Module 13 feature) is explicitly Sprint 12 scope
— this sprint builds the substrate it will act on, not a stand-in for
it.

**5. Attempt authorization is coarse-grained, matching Sprint 6's
precedent.** Any `learner`-role tenant member can attempt a published
exam; there's no check that they're specifically enrolled in the
exam's course, because that check requires reading Learning's
enrollment table, which the Assessment module cannot import directly
(module boundary). This mirrors Teacher Portal's attendance
authorization exactly, and the fix is the same: a shared
enrollment-query port in core, following `UserProvisioningService`'s
pattern, whenever a future sprint needs it.

## A second real bug, same root cause as before

Migration 0013 called `core.make_syncable('assessment.certificates')`
without giving the table the `row_version` and `updated_at` columns
that helper's triggers unconditionally reference. Every write failed
at the trigger with `record "new" has no field "row_version"` — caught
immediately by the integration test's very first certificate-issuance
call, not by inspection. Fixed forward in migration 0014 rather than
editing 0013, per ADR-004's immutability rule: a fresh install applies
0013 (bug) then 0014 (fix) in sequence and ends in the same state as
a database that had 0013 patched after the fact.

This is now the second time a call to `core.make_syncable`/`bump_row_version`
has broken on a table missing one of its three required columns
(`tenant_id`, `row_version`, `updated_at`). The lesson to actually
internalize: **before calling `make_syncable`, check the table has all
three columns** — the helper has no way to fail loudly at migration-write
time, only at first-write time, which is exactly when it's most
disruptive to discover.

## Consequences

- Any future syncable-adjacent table gets a pre-flight checklist:
  `tenant_id`, `row_version`, `updated_at` present, *then* call
  `core.make_syncable`.
- Assessment joins Learning (submissions/attendance) as the third
  module demonstrating a distinct conflict-class/integrity decision —
  future modules now have three worked examples (create-only,
  last-write-wins, deliberately-not-synced) to choose from.

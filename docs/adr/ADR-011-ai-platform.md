# ADR-011: Sprint 12 — AI Platform, safety-first

Status: Accepted · Date: 2026-07-30

## Context

This sprint is qualitatively different from every prior one: it requires
calling an actual LLM, and it serves an audience that includes children
as young as ~4 (CBC PP1). Scope discipline here isn't about picking the
biggest slice — it's about never letting AI-generated content reach a
student unreviewed.

## Decisions

**1. Honest sandbox, same pattern as M-Pesa.** `core/ai/ai-provider.port.ts`
defines `AiProvider`; `SandboxAiProvider` is the only implementation and
makes no network call — it returns a clearly labeled placeholder. No
Anthropic API credentials exist in this environment. A production
provider is a registration swap in `CoreModule`, not an application-code
change.

**2. Three features, three applications of the same rule: AI drafts, a
human decides.**
- *Exam questions* (Assessment): land with `review_status = 'pending'`.
  The random-draw query — the actual mechanism that puts a question in
  front of a student — filters to `'approved'` only. This isn't a
  service-layer check that could be bypassed by a different code path;
  it's in the SQL that selects exam content, full stop.
- *Lesson plans* (Teacher Portal): AI is just another way to CREATE a
  draft in the exact same `draft -> submitted -> approved` table Sprint 6
  already built. No parallel AI-approval workflow exists.
- *Feedback* (Learning): the draft is returned in the API response and
  never written to `submissions.feedback`. Applying it -- verbatim,
  edited, or discarded -- still requires the teacher to call the
  existing `grade` endpoint, same as feedback they typed themselves.

**3. Homework help is single-turn and logged, not a persistent chat.**
Every request is a standalone Q&A tied to a subject/grade; there is no
open-ended conversation state. `ai.interactions` logs every call
platform-wide -- which persona, what was asked, what came back -- giving
a school (and, as a natural Parent Portal extension, a guardian)
visibility into exactly what AI content a child was exposed to. This
table is deliberately excluded from the sync/pull feed: it may contain
a specific child's question, and it's a server-side audit trail, not a
client-cacheable record.

**4. Administrator/Government AI is out of scope here.** Forecasting,
dropout prediction, and policy analytics belong with the data
aggregation Sprints 13-14 (Government Dashboard, Analytics) already
own -- building predictive features now would duplicate that work
rather than reuse it.

## A test-infrastructure fix, not a code bug

Running the full suite in parallel (Jest's default worker count) started
failing intermittently as suite count grew to 21-22: each integration
spec boots a full Nest app, and each app opens its own `DatabaseService`
pool (max 20) plus an `OutboxRelay` pool (max 2). At enough concurrent
workers, aggregate connections approached Postgres's `max_connections`
(100 in this environment), causing sporadic `ECONNREFUSED` failures that
had nothing to do with the code under test. Capped `maxWorkers` in
`apps/api/package.json`'s Jest config -- first to 4 (still flaky at this
suite count), then to 2 (three consecutive full clean runs, 132/132).
This is exactly the kind of thing that looks like flaky tests until you
count the actual connection math; it will need revisiting again as more
sprints add suites.

## Consequences

- Every future AI-touching feature has three concrete precedents to
  follow (pending-review content, reused-workflow drafts, return-not-persist),
  rather than needing to invent a fourth safety pattern from scratch.
- `ai.interactions` is the natural backing store for a future Parent
  Portal "what did my child ask the AI helper" view -- the data model
  already supports it; only a composition-layer read endpoint remains.
- The Jest worker cap is a number that will need to move again; the
  underlying math (workers times connections-per-app vs. max_connections)
  is the thing to actually reason about, not the specific number 2.

# ElimuBora

Kenya's National Digital Education Platform — monorepo.

## Layout

    apps/api        NestJS modular monolith (core platform + domain modules)
    apps/web        Next.js web client (PWA in a later sprint)
    packages/domain Shared domain contracts (types, event registry)
    packages/ui     Design tokens + shared UI primitives
    db/migrations   SQL-first schema (RLS, audit, outbox)
    tools           Migration runner
    docs/adr        Architecture Decision Records

## Quickstart

    npm install
    docker compose up -d                # Postgres 16 + Redis 7
    cp .env.example .env
    npm run db:migrate                  # applies db/migrations/*.sql
    npm run dev:api                     # http://localhost:4000/health
    npm run dev:web                     # http://localhost:3000

## Verification

    npm run typecheck        # all workspaces
    npm test                 # unit + e2e (no database required)
    npm run lint:boundaries  # architectural rules (dependency-cruiser)

    # full integration suite (requires migrated Postgres, see CI):
    INTEGRATION_DATABASE_URL=postgres://elimubora_app:app_dev_password@localhost:5432/elimubora \
    INTEGRATION_ADMIN_DATABASE_URL=postgres://elimubora:elimubora_dev_password@localhost:5432/elimubora \
    npm test

## Offline sync (Sprint 4+)

    POST /v1/sync/pull   { cursor }              -> { changes, nextCursor, hasMore }
    POST /v1/sync/push   { mutations: [...] }    -> per-mutation applied/rejected outcome

Mutations are idempotent by client-generated id (core.applied_mutations).
Two conflict classes are implemented as working examples for any future
syncable entity: submissions (create-only, first-write-wins, Sprint 4)
and attendance (last-write-wins, unconditional overwrite, Sprint 6).
See docs/adr/ADR-007 and ADR-009.

## Web frontend (login + auth)

    /                    Role-selector landing page (Teacher/Student/Parent/
                          Admin/Ministry doors)
    /login/[role]         Login form: credentials -> MFA step-up -> institution
                          picker, matching AuthService's three real outcomes
    /dashboard            Minimal authenticated confirmation page
    /api/auth/*           Next.js Route Handlers (BFF): tokens live in httpOnly
                          cookies, never in client-readable storage

See docs/adr/ADR-014 for the httpOnly-cookie architecture and two real
bugs found by finally booting the actual production entrypoint
end-to-end for the first time in the project.

## Domain modules (Sprints 5-10)

    Sprint 5  Student Information System   /students /admissions /transfers /guardians
    Sprint 6  Teacher Portal               /attendance /lesson-plans
    Sprint 7  Parent Portal (composition)  /parent-portal/*
    Sprint 8  School Administration        /rooms /timetable /leave-requests
    Sprint 9  Finance                      /fee-structures /invoices /payments/mpesa
    Sprint 10 Digital Library              /library/resources
    Sprint 11 Assessment Platform           /question-banks /exams /exam-attempts /certificates
    Sprint 12 AI Platform                    /ai/homework-help, /lesson-plans/ai-draft, /question-banks/:id/questions/ai-draft
    Sprint 13 Government Dashboard           /gov/enrollment /gov/attendance (+ /refresh, ministry-only)
    Sprint 14 Analytics                      /analytics/course/:id /analytics/teacher/:id/grading-backlog
                                              /analytics/finance/collection-summary /analytics/early-warning

`apps/api/src/composition/` is a permitted exception to "modules never
import each other" — read-only cross-module aggregation for dashboards
(Teacher Dashboard, Parent Portal), enforced one-directional by the
`modules-cannot-import-composition` dependency-cruiser rule. See
ADR-008.

The M-Pesa integration (Finance) is a real adapter boundary
(`core/payments/payment-gateway.port.ts`) with only a sandbox
implementation — no real Safaricom Daraja credentials exist in this
environment. See ADR-009.

## Non-negotiables (see docs/adr)

1. Tenant isolation is enforced by Postgres RLS, not application code.
2. Every state change writes an audit entry and (when other modules
   care) an outbox event **in the same transaction**.
3. Domain modules never import each other; CI fails the build if they do.
4. Migrations are immutable once applied; fix forward with a new file.

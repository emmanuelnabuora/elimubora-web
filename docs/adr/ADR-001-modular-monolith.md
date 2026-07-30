# ADR-001: Modular monolith before microservices

Status: Accepted · Date: 2026-07-28

## Context
ElimuBora spans 15 modules targeting 20k+ schools. A distributed
microservice architecture from day one multiplies operational cost
(service discovery, distributed tracing, per-service CI/CD, network
failure modes) before there is any traffic to justify it.

## Decision
One NestJS application. Bounded contexts live in `apps/api/src/modules/*`
with boundaries enforced in CI by dependency-cruiser: no module imports a
sibling; cross-module effects flow through domain events via the
transactional outbox; shared contracts live in `packages/domain`.

## Consequences
- Single deployable, single database transaction scope, fast iteration.
- Extraction path: a module's tables, events and API surface are already
  isolated, so moving it behind a network boundary is mechanical.
- Likely first extractions: Assessment (exam-time burst load) and
  Finance (distinct security/audit profile).

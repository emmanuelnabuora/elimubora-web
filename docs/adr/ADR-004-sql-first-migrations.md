# ADR-004: SQL-first migrations, no ORM

Status: Accepted · Date: 2026-07-28

## Context
RLS policies, roles, grants, triggers and partial indexes are first-class
citizens of this schema. ORMs model tables, not security posture, and
hide the exact SQL that auditors (DPA 2019, future ISO 27001) must review.

## Decision
Plain SQL files in `db/migrations`, applied by `tools/migrate.mjs`
(transactional, checksummed, advisory-locked, immutable once applied).
Application code uses `pg` directly with typed row interfaces.

## Consequences
- The schema is reviewable as SQL in pull requests.
- Query-builder ergonomics (e.g. Kysely) can be added later without
  changing the migration strategy.

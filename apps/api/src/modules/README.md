# Domain modules

Each business capability (learning, sis, finance, assessment, ...) lives in
its own directory here as a bounded context.

Rules (enforced by `.dependency-cruiser.cjs` in CI):

1. A module may import from `src/core` and `@elimubora/domain` — never from
   a sibling module.
2. Cross-module effects flow through domain events: write to the outbox in
   your transaction; subscribe to other modules' events via the
   EventPublisher.
3. Every state change writes an audit entry in the same transaction.
4. All tenant-scoped SQL runs inside `DatabaseService.withTenantTransaction`.

These rules are what make later extraction to services a mechanical
refactor instead of a rewrite.

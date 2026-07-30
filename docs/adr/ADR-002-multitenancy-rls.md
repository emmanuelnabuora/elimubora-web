# ADR-002: Shared schema multi-tenancy with Postgres RLS

Status: Accepted · Date: 2026-07-28

## Context
20,000+ tenants rules out database-per-tenant (operational impossibility)
and schema-per-tenant (catalog bloat, migration fan-out).

## Decision
Shared tables with `tenant_id`, isolated by Row-Level Security policies
reading `current_setting('app.tenant_id')`. The API connects as
`elimubora_app` with FORCE RLS; every tenant-scoped statement runs inside
`DatabaseService.withTenantTransaction`, which binds the setting
transaction-locally. Background jobs use `elimubora_worker` (explicit cross-tenant policies)
and are the only cross-tenant readers.

## Consequences
- Isolation enforced by the database — a forgotten WHERE clause cannot
  leak another school's data.
- National/county analytics read from a replica/warehouse, never via
  RLS bypass in the API path.
- Very large tenants can later be moved to dedicated shards; the
  application code is shard-agnostic because tenancy is ambient.

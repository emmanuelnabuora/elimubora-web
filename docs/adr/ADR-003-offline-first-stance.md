# ADR-003: Offline-first is a data-model constraint, not a feature

Status: Accepted · Date: 2026-07-28

## Context
Large parts of Kenya have intermittent connectivity. Retrofitting
offline sync onto an online-only data model historically fails.

## Decision
From Sprint 1, every mutable entity design must declare:
1. Its identifier strategy (client-generated UUIDs so records can be
   created offline).
2. Its conflict class: last-write-wins (attendance), merge-review
   (grades), or server-authoritative (payments — never created offline).
3. Idempotency: all write APIs accept an idempotency key so queued
   offline mutations can be replayed safely.
The full sync protocol (change log + logical clocks) is specified before
Sprint 4 (Learning Platform), the first offline-capable module.

## Consequences
- Slightly heavier entity design reviews now; no rebuild later.
- The outbox/event log doubles as the server-side change feed for sync.

# ADR-005: Authentication architecture

Status: Accepted · Date: 2026-07-28

## Context
One person, many institutions: teachers transfer, county officers span
schools, parents have children in different schools. National-scale
identity cannot be per-tenant.

## Decisions
1. **Global identity, tenant-scoped access.** `core.users` is global;
   `core.memberships` binds user↔tenant with a role. Access tokens are
   issued for exactly one (tenant, role) pair; switching institutions
   means a new token, never a mutable session.
2. **Argon2id** (19 MiB, t=2, p=1 — OWASP) for passwords; uniform
   errors prevent user enumeration; persistent lockout (5 fails/15 min)
   survives restarts and applies across replicas.
3. **Short-lived HS256 JWT access tokens** (15 min; claims sub/ten/rol/
   sid) + **opaque rotating refresh tokens** stored as SHA-256 hashes.
   Reuse of a rotated token revokes its whole family — the standard
   theft response. HS256 moves to asymmetric keys (JWKS) when a second
   service needs to verify tokens; TokenService isolates that change.
4. **RLS context from verified claims.** JwtAuthGuard rebinds the
   ambient tenant context from the token. Client headers can never
   influence tenant scoping in production.
5. **TOTP MFA** with AES-256-GCM-encrypted secrets and a dedicated
   5-minute `typ=mfa` challenge token that grants no API access.
6. Onboarding is invitation-based (Sprint 3); the open-registration
   endpoint exists for development only and the config loader refuses
   the flag in production.

## Consequences
- SSO (OIDC/SAML for eCitizen, Google Workspace for Education) plugs in
  as additional credential verifiers issuing the same session shape.
- `FORCE ROW LEVEL SECURITY` means even the table owner cannot read
  tenant data without a policy — verified in the integration suite.

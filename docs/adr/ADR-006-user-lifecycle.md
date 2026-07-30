# ADR-006: User lifecycle and users-table hardening

Status: Accepted · Date: 2026-07-28

## Decisions
1. **Invitation-based onboarding.** Admin roles issue invitations
   (7-day expiry, single-use, SHA-256 hash at rest). Accepting either
   creates the account or attaches a membership to an existing account
   for that email — one person, one identity, per ADR-005. Raw tokens
   leave the system only via the notification channel.
2. **core.users under FORCE RLS.** Policies: self (read/write own row),
   tenant-members (admins see members of the current tenant), insert
   (app-mediated creation), worker read. Pre-authentication paths
   (login, MFA, password reset) go through narrow SECURITY DEFINER
   functions owned by a dedicated NOLOGIN role (`elimubora_auth`) with
   a fixed search_path — the app role can authenticate users it cannot
   otherwise read.
3. **INSERT ids are app-generated.** Postgres applies SELECT policies
   to `INSERT .. RETURNING`, and a new user is visible to no one yet;
   app-side UUIDs sidestep this and match the ADR-003 offline-first
   identifier strategy.
4. **Session hygiene.** Suspending or removing a membership, and
   completing a password reset, revoke every refresh-token family for
   the user. Reset requests are uniform (no account enumeration) and
   reset tokens are single-use with a 30-minute TTL.
5. **No self-lockout.** An admin can never suspend, demote or remove
   their own membership.

## Notes
- Pre-auth flows cannot write tenant-scoped audit rows (no tenant
  context); a platform-level audit stream is scheduled for Sprint 16
  (Production Hardening).
- Notification delivery is a port; Sprint 12 (Communication) supplies
  SMS/WhatsApp/email channels behind the same interface.

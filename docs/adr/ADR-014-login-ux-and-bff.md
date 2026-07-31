# ADR-014: Role-selector login UX and the httpOnly-cookie BFF

Status: Accepted · Date: 2026-07-31

## Context

Every prior sprint built API surface; the Next.js frontend had only
ever gotten a status page (Sprint 1). This piece of work gives the
platform its first real, working login experience, matching a
role-selector design the person supplied: separate doors for Teacher,
Student, Parent, School Administrator, and Ministry/County/Partner.

## Decisions

**1. A role-selector landing page is a UX affordance, not a different
auth mechanism.** All five doors submit to the exact same
POST /v1/auth/login (email + password); the role only drives copy,
accent color, and post-login framing. The alternative -- genuinely
different login mechanics per persona (e.g., admission-number login
for young learners) -- is real, valuable, future work, not something
to fake here.

**2. Tokens live in httpOnly cookies, set by a thin Next.js
Route-Handler BFF -- never in a client-readable store.** /api/auth/login,
/mfa, /logout, /me are the only code that ever sees a raw
access/refresh token; the browser's own JS never does. This is the
standard defense against XSS token theft and was verified for real,
not assumed: a live end-to-end run against genuinely running API and
web servers confirmed Set-Cookie headers carry HttpOnly; Secure;
SameSite=lax with the correct Max-Age for both tokens, the JSON
response body never contains a raw token, /dashboard (a Server
Component) correctly reads the session server-side, and logout
genuinely revokes it -- confirmed by the follow-up /api/auth/me call
returning 401.

**3. /api/auth/me (and the shared getCurrentUser() helper it and
the dashboard both call) silently refreshes an expired access token
once before giving up.** One implementation, not duplicated between
the Route Handler and the Server Component -- the dashboard page calls
the same helper directly rather than a self-referential fetch to its
own API route.

**4. Footer pages (Help, Privacy, Accessibility, Language) are honest
stubs, not fabricated content.** Writing placeholder legal/policy text
that looks real would misrepresent the platform's actual privacy
posture; each stub says plainly that the real content is coming,
which is more useful and more honest than a templated wall of text
nobody wrote.

## Two real bugs, both found only by actually running the thing

**A genuine backend gap, not just a frontend inconvenience.** Building
the institution-picker UI required data the backend never provided:
AuthService.login (Sprint 2) threw a plain ForbiddenException string
when a user belonged to more than one institution, giving the frontend
nothing to render a picker from. Fixed by adding a real
select_institution result carrying the actual memberships list --
covered by a new unit test proving the list comes back correctly and
that a follow-up call with tenantId resolves normally. This is exactly
the kind of gap that only surfaces when a real client actually needs
the data, not when the endpoint is tested in isolation.

**The most structurally interesting bug of the whole project so far:**
booting main.ts directly -- the actual production entrypoint -- for
the first time in fourteen sprints immediately failed with 'The
"class-validator" package is missing'. Every single integration test
across every sprint boots the app via Nest's TestingModule harness
(Test.createTestingModule(...).compile()), which does not execute
main.ts's bootstrap() function at all. main.ts carried a global
ValidationPipe from @nestjs/common -- a Sprint 1 scaffold leftover --
that requires class-validator/class-transformer as peer dependencies.
This codebase has used Zod exclusively (ZodValidationPipe, applied
per-route) since Sprint 2; the global pipe validated nothing that Zod
wasn't already validating and was simply removed. The uncomfortable
fact worth sitting with: the platform's real entrypoint had never
successfully booted outside a test harness until this sprint, and
nothing in 140+ prior passing tests could have caught that, because
none of them exercised it.

## Consequences

- Any future claim of "the tests pass" should be read as "the
  TestingModule-bootstrapped app behaves correctly" -- genuinely
  different from "the deployable app boots," as this sprint just
  demonstrated concretely. A smoke test that runs the actual main.ts
  entrypoint (or at minimum imports and constructs it) is a reasonable
  follow-up to close this gap permanently rather than relying on
  someone remembering to check by hand again.
- The httpOnly-cookie BFF pattern established here
  (lib/auth-cookies.ts, lib/get-current-user.ts) is the template for
  any future authenticated page or API route the frontend adds -- no
  page should read or write a token directly.
- Admission-number login for young CBC learners (who may not have or
  remember an email) remains a real, worthwhile enhancement, not
  built in this pass.

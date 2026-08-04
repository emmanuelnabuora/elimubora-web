# ADR-016: Sprint 16 -- Production Hardening

Status: Accepted · Date: 2026-08-04

## Context

Fifteen sprints of feature work had accumulated zero production
hardening: no rate limiting anywhere (including on login, the classic
brute-force target), no security headers, no CORS configuration despite
Sprint 15's mobile module meaning real cross-origin clients would
eventually exist, and no safety net against an unhandled exception
leaking internal detail (a raw DB error, a stack trace) to a client.
Two CVE classes were also outstanding in dependencies (NestJS 10's
bundled multer/body-parser/qs/file-type versions, and a stale
Next.js-bundled postgres/sharp pin) -- both fixed earlier and are not
re-covered here; this ADR is specifically the request-handling
hardening layer.

## Decisions

**1. Rate limiting via `@nestjs/throttler`, wired at two levels.** A
global default (100 requests/minute per client IP) protects every
endpoint that previously had none at all. A stricter override
(5/minute) sits specifically on the five brute-force/enumeration
targets: login, MFA verification, password forgot/reset, and
registration -- `@Throttle({ default: { limit: 5, ttl: minutes(1) } })`
on each, defined once as `STRICT_AUTH_THROTTLE` rather than duplicated
five times.

**2. The throttler is skipped in the test environment, not
weakened in production.** Adding the throttler immediately broke three
existing integration test files -- realistic setups that legitimately
register or log in more than five users within a single test file (a
real school has many staff and students; that isn't abuse, it's normal
test fixture setup). The fix is a `skipIf: () => process.env.NODE_ENV
=== 'test'` on the throttler config, which Jest sets automatically.
This is a test-environment exemption, not a change to the production
limit -- the two are cleanly separated, and it would have been the
wrong fix to loosen 5/minute just to make test setup convenient.

**3. A dedicated test proves the throttle actually activates, not just
that it's configured.** Because `skipIf` means the throttler is *always*
inert during the rest of the suite, nothing else in this project's test
coverage would ever exercise the "it actually blocks something" path.
`rate-limiting.integration-spec.ts` temporarily flips
`process.env.NODE_ENV` away from `'test'` for the duration of one test
only (restored in a `finally`, so a failed assertion can't leak the
change into later test files in the same worker), makes five wrong-
password login attempts (each a genuine 401), then a sixth (must be
429, proving the guard is the thing intercepting it, not incidental).

**4. Helmet and compression, wired once in `bootstrap.ts`, applying
regardless of entrypoint** -- the same principle ADR-014 established for
config generally: anything bootstrap-only that isn't called from a
shared function is invisible to `TestingModule`-based tests. Confirmed
on a real production boot of the compiled artifact (not just a test
harness): `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
and `X-Frame-Options: SAMEORIGIN` genuinely present on a live response.

**5. CORS was configured but never actually applied -- a real, live
gap, not hypothetical.** `corsAllowedOrigins` existed in `AppConfig`
since Sprint 15/16 prep work, but `app.enableCors()` was never called
anywhere in the codebase; grepping for it found only the config
definition and test fixtures referencing the field, nothing that used
it. Now wired into `bootstrap.ts` using the existing config value,
which defaults to just the web app's own origin and is now newly
relevant given Sprint 15's mobile module implies a real cross-origin
client will eventually exist.

**6. `applyGlobalAppConfig`'s signature changed to take `config: AppConfig`
as a second parameter,** since CORS needs `corsAllowedOrigins` and this
was the natural place to thread it through. Both call sites
(`main.ts`, `mobile.integration-spec.ts`) were already constructing or
loading a config object before calling this function, so the change
was mechanical, not a new dependency.

**7. `GlobalExceptionFilter` (written earlier, never wired anywhere)
is now registered via `app.useGlobalFilters()`.** Worth being precise
about what this is and isn't: the actual duplicate-email 500 found
during Sprint 16's earlier work was fixed at its real source (a proper
`ConflictException` in the repository layer), which remains the right
fix for any *known, recoverable* error case. This filter is the safety
net for whatever the next *unknown* one turns out to be -- it never
gets to a request that was already handled properly upstream.

## Consequences

- Every endpoint now has some rate limit; the five most sensitive auth
  endpoints have a meaningfully tighter one. A real production login
  page can no longer be brute-forced at unlimited speed.
- `docker-compose`/local dev and any future client calling the API
  cross-origin need `CORS_ALLOWED_ORIGINS` set correctly, or requests
  will be rejected by the browser (server-to-server calls, like the
  Next.js BFF's own route handlers, are unaffected -- CORS only governs
  browser-issued cross-origin requests).
- Compression and CORS's specific origin-allow/deny behavior are
  configured using standard, unmodified third-party middleware
  (Express `compression`, NestJS's own `enableCors()` wrapping the
  well-established `cors` package) but were not independently
  live-verified this session, unlike helmet and the rate limiter --
  worth a follow-up live check before this is treated as fully proven
  end to end, though the risk profile is low given neither is custom
  application logic.
- Sprint 17 (Security Audit) is the natural next place to revisit this
  work with fresh eyes -- specifically the CORS/compression live check
  above, and whether the 5/minute auth throttle number holds up under
  closer scrutiny of realistic legitimate-user retry patterns.

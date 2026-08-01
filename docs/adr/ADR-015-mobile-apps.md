# ADR-015: Sprint 15 -- Mobile Apps, honest about what this sandbox can build

Status: Accepted · Date: 2026-07-31

## Context

The brief covers native Android/iPhone apps, offline sync, background
sync, push notifications, QR attendance, and camera upload. This
sandbox has no Xcode, no Android SDK, no simulator, and no way to
compile or run Swift, Kotlin, or even a React Native bundle
meaningfully. Producing large amounts of native-adjacent UI code with
no way to verify it compiles or runs would break the standard every
prior sprint has held -- everything shipped here has been real,
tested, and verified, not just plausible-looking.

## Decisions

**1. Offline/background sync needed zero new backend work.** Sprint
4's sync engine (core.change_log, core.applied_mutations,
SyncService.pull/push) was designed from ADR-003 specifically
anticipating an offline-first mobile client. A mobile app is simply a
consumer of /v1/sync/pull and /v1/sync/push -- nothing to build.

**2. Push notifications: a port, not a real integration.** No FCM/APNs
credentials exist in this environment. PushProvider (core/push/)
follows the exact AI/M-Pesa sandbox pattern: a real interface, one
implementation that logs rather than sends, swappable for a real
provider via a CoreModule registration change with no application-code
change.

**3. Camera upload is genuinely functional, not a stub.** Unlike
push/AI/payments, local-disk storage is something this sandbox
actually has working access to. LocalFileStorageProvider writes and
reads real bytes on real disk -- proved with an actual round-trip test
(upload real bytes, retrieve them, compare buffers byte-for-byte,
identical). This is a legitimately deployable choice for a small
single-region footprint; swapping to S3/R2 for a larger deployment is
the same provider-swap pattern, not a correctness fix.

**4. QR attendance reuses Sprint 6's attendance system exactly, in two
variants.** Self-service (a learner scans a teacher-displayed session
code to check themselves in) and teacher-scan (staff check in a
student by badge). The second variant exists specifically because
Sprint 5's shadow-account young learners have intentionally unusable
credentials and cannot self-authenticate at all -- a real product
constraint, not a hypothetical one, surfaced back in Sprint 12 and
Sprint 14's own tests hitting the same wall.

**5. A second cross-module port, same shape as AI/Payment/Push/Storage.**
modules/mobile needs to mark attendance -- Teacher Portal's owned
data -- without importing that module directly. AttendanceMarker
(core/attendance/) is the interface; TeacherPortalAttendanceMarker is
Teacher Portal's concrete implementation; the binding happens at the
composition layer (composition/attendance-marker-binding.module.ts), a
@Global() module whose only job is DI wiring, not business logic --
reasonable to import a domain module despite living alongside
composition/'s read-aggregation controllers, since it exposes no
read/write surface of its own for the modules-cannot-import-composition
rule to protect against. Verified with a clean dependency-cruiser run:
modules/mobile never appears as an importer of modules/teacher-portal.

## A second real instance of ADR-014's lesson

Building the upload size-limit test surfaced Express's default JSON
body-parser limit (100KB), which rejected a large base64-encoded photo
*before* the application's own MAX_UPLOAD_BYTES check ever ran --
returning a raw 413 instead of the intended clean 400. Fixing this
only in main.ts would have repeated ADR-014's exact mistake: config
that lives in one bootstrap path is invisible to every test using
NestFactory.create() directly. Instead, apps/api/src/bootstrap.ts
exports applyGlobalAppConfig(), called by both main.ts and
mobile.integration-spec.ts -- one implementation, not two places to
independently remember a limit value. This is the second real,
concrete case of this bug class in as many sprints; any future global
app-level configuration (interceptors, additional pipes, CORS, body
limits) belongs in this shared function, not inlined into main.ts alone.

## Consequences

- PushProvider is ready for Sprint 16+ if a feature needs to actually
  notify someone (e.g., an urgent Government Dashboard early-warning
  alert) -- registration swap only.
- Native app client code (Swift/Kotlin/React Native) remains explicitly
  out of scope for this environment. If a real mobile client is ever
  built, it is simply another consumer of the API surface that already
  exists: auth, sync, and this sprint's device/upload/QR endpoints.
- applyGlobalAppConfig() is now the checklist item: any future global
  bootstrap concern goes there, and any future test needing real
  request-handling behavior should call it rather than duplicating
  setGlobalPrefix inline.

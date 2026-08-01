-- ============================================================
-- 0017_mobile.sql — Mobile Apps.
--
-- Scope decision: this sprint's brief covers native Android/iPhone
-- apps, offline sync, background sync, push notifications, QR
-- attendance, and camera upload. Offline/background sync is already
-- built (Sprint 4's sync engine — ADR-003 designed it for exactly
-- this from day one; a mobile client is simply a consumer of
-- /v1/sync/pull and /v1/sync/push, no new backend work needed). This
-- migration adds the two genuinely new pieces of server
-- infrastructure a mobile client needs: device registration (for
-- push) and upload metadata tracking (for camera photos). QR
-- attendance needs no new table at all — it reuses
-- teacherportal.attendance_records via a signed, stateless token
-- (see modules/mobile), verified without a database round trip.
--
-- Native app code itself (Swift, Kotlin, or a cross-platform
-- framework) is not built here — this sandbox has no compiler, SDK,
-- or simulator for any of them, and producing UI code with no way to
-- verify it compiles or runs would be dishonest given the standard
-- this project has held everywhere else.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS mobile;
GRANT USAGE ON SCHEMA mobile TO elimubora_app, elimubora_worker;

CREATE TABLE mobile.devices (
  id           uuid PRIMARY KEY,
  tenant_id    uuid NOT NULL REFERENCES core.tenants(id),
  user_id      uuid NOT NULL REFERENCES core.users(id),
  platform     text NOT NULL CHECK (platform IN ('ios', 'android')),
  push_token   text NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (push_token)
);
CREATE INDEX idx_devices_user ON mobile.devices (user_id);

ALTER TABLE mobile.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobile.devices FORCE ROW LEVEL SECURITY;
CREATE POLICY devices_tenant ON mobile.devices
  TO elimubora_app
  USING (tenant_id = core.current_tenant_id())
  WITH CHECK (tenant_id = core.current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON mobile.devices TO elimubora_app;
-- The push dispatcher reads across every tenant's devices (a single
-- announcement can target many schools' worth of guardians) via the
-- worker role, mirroring Government Dashboard's aggregation pattern.
CREATE POLICY devices_worker_read ON mobile.devices
  FOR SELECT TO elimubora_worker USING (true);
GRANT SELECT ON mobile.devices TO elimubora_worker;

CREATE TABLE mobile.uploads (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES core.tenants(id),
  uploaded_by   uuid NOT NULL REFERENCES core.users(id),
  storage_key   text NOT NULL UNIQUE,
  content_type  text NOT NULL,
  size_bytes    int NOT NULL CHECK (size_bytes > 0),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_uploads_uploader ON mobile.uploads (uploaded_by);

ALTER TABLE mobile.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobile.uploads FORCE ROW LEVEL SECURITY;
CREATE POLICY uploads_tenant ON mobile.uploads
  TO elimubora_app
  USING (tenant_id = core.current_tenant_id())
  WITH CHECK (tenant_id = core.current_tenant_id());
GRANT SELECT, INSERT ON mobile.uploads TO elimubora_app;

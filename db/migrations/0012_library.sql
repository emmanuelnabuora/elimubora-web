-- ============================================================
-- 0012_library.sql — Digital Library.
--
-- A resource catalog (books, videos, simulations, past papers,
-- teacher guides, interactive content) filterable by subject and
-- grade level, made syncable so an offline client can pull the
-- catalog and download manifest. Actual file storage/streaming is
-- out of scope here — storage_key is an opaque pointer into whatever
-- object store (S3/Cloudflare R2) the deployment uses; serving the
-- bytes is an infrastructure concern, not a schema one.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS library;
GRANT USAGE ON SCHEMA library TO elimubora_app, elimubora_worker;

CREATE TABLE library.resources (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES core.tenants(id),
  title         text NOT NULL,
  resource_type text NOT NULL CHECK (resource_type IN
                ('book', 'video', 'simulation', 'past_paper', 'teacher_guide', 'interactive')),
  subject       text NOT NULL,
  grade_level   text,                  -- NULL = not grade-specific (e.g. a general teacher guide)
  description   text,
  storage_key   text NOT NULL,         -- opaque object-store pointer
  tags          text[] NOT NULL DEFAULT '{}',
  created_by    uuid NOT NULL REFERENCES core.users(id),
  row_version   bigint NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE INDEX idx_resources_subject_grade
  ON library.resources (subject, grade_level) WHERE deleted_at IS NULL;
CREATE INDEX idx_resources_tags ON library.resources USING gin (tags) WHERE deleted_at IS NULL;
SELECT core.make_syncable('library.resources');

CREATE TABLE library.resource_access_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES core.tenants(id),
  resource_id uuid NOT NULL REFERENCES library.resources(id),
  user_id     uuid NOT NULL REFERENCES core.users(id),
  action      text NOT NULL CHECK (action IN ('viewed', 'downloaded')),
  accessed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_resource_log_resource ON library.resource_access_log (resource_id, accessed_at DESC);
CREATE INDEX idx_resource_log_user ON library.resource_access_log (user_id, accessed_at DESC);

ALTER TABLE library.resource_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE library.resource_access_log FORCE ROW LEVEL SECURITY;
CREATE POLICY resource_access_log_tenant ON library.resource_access_log
  TO elimubora_app
  USING (tenant_id = core.current_tenant_id())
  WITH CHECK (tenant_id = core.current_tenant_id());
GRANT SELECT, INSERT ON library.resource_access_log TO elimubora_app;
GRANT USAGE ON SEQUENCE library.resource_access_log_id_seq TO elimubora_app;

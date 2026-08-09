-- 0033_transfer_requests.sql
--
-- A student asking their current school for a transfer is a
-- genuinely different, lighter-weight thing than the formal,
-- inter-school sis.transfers record: a student can't (and shouldn't)
-- be able to unilaterally kick off a request straight to another
-- school's admin -- their own school needs to see the ask first,
-- confirm the student is actually cleared to leave (fees, library
-- books, school property settled), and only then formally initiate
-- the existing transfer, which still goes to the receiving school
-- for approval exactly as it already does. This table is that
-- intermediate, single-tenant step; it never bypasses
-- sis.transfers or its host-school approval requirement -- it feeds
-- into it via converted_transfer_id once cleared.

CREATE TABLE sis.transfer_requests (
  id                   uuid PRIMARY KEY,
  tenant_id            uuid NOT NULL REFERENCES core.tenants(id),
  student_id           uuid NOT NULL REFERENCES sis.student_profiles(student_id),
  requested_by         uuid NOT NULL REFERENCES core.users(id),
  preferred_tenant_id  uuid REFERENCES core.tenants(id),
  reason               text,
  status               text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'declined', 'converted')),
  cleared              boolean NOT NULL DEFAULT false,
  cleared_by           uuid REFERENCES core.users(id),
  cleared_at           timestamptz,
  clearance_note       text,
  decided_by           uuid REFERENCES core.users(id),
  decided_at           timestamptz,
  decision_reason      text,
  converted_transfer_id uuid REFERENCES sis.transfers(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz
);
CREATE INDEX idx_transfer_requests_tenant ON sis.transfer_requests (tenant_id);
CREATE INDEX idx_transfer_requests_student ON sis.transfer_requests (student_id);
CREATE TRIGGER trg_transfer_requests_updated BEFORE UPDATE ON sis.transfer_requests
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

-- Coarse, tenant-level isolation only -- same convention as every
-- other single-tenant table in this schema. The finer rule (a
-- learner sees only their own request, staff see every request at
-- the school) is enforced in the service layer, matching how this
-- module already separates learner-scoped from staff-scoped listings
-- elsewhere (e.g. AssessmentService.listExams).
ALTER TABLE sis.transfer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sis.transfer_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY transfer_requests_tenant ON sis.transfer_requests
  TO elimubora_app
  USING (tenant_id = core.current_tenant_id())
  WITH CHECK (tenant_id = core.current_tenant_id());
GRANT SELECT, INSERT, UPDATE ON sis.transfer_requests TO elimubora_app;

-- ============================================================
-- 0009_finance.sql — Finance.
--
-- Scope decision: the original brief lists School Fees, Invoices,
-- Receipts, Scholarships, Bursaries, Budgets, Procurement, Financial
-- Reports, M-Pesa Integration, Bank Integration, Payment Plans —
-- eleven sub-systems. This migration builds fee structures, invoices,
-- and payments (which together give receipts and balance tracking
-- for free) plus the M-Pesa adapter boundary. Scholarships/bursaries,
-- budgets, procurement, and full financial reporting are deferred to
-- dedicated future sprints.
--
-- Money is numeric(12,2) throughout — never float. Payments are
-- append-only against an invoice; the invoice's amount_paid and
-- status are DERIVED, recomputed transactionally on every payment,
-- never trusted from client input.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS finance;
GRANT USAGE ON SCHEMA finance TO elimubora_app, elimubora_worker;

CREATE TABLE finance.fee_structures (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES core.tenants(id),
  grade_level   text NOT NULL,
  academic_year int NOT NULL,
  term          smallint NOT NULL CHECK (term BETWEEN 1 AND 3),
  amount        numeric(12,2) NOT NULL CHECK (amount > 0),
  description   text,
  row_version   bigint NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  UNIQUE (tenant_id, grade_level, academic_year, term)
);
SELECT core.make_syncable('finance.fee_structures');

CREATE TABLE finance.invoices (
  id               uuid PRIMARY KEY,
  tenant_id        uuid NOT NULL REFERENCES core.tenants(id),
  student_id       uuid NOT NULL REFERENCES core.users(id),
  fee_structure_id uuid NOT NULL REFERENCES finance.fee_structures(id),
  academic_year    int NOT NULL,
  term             smallint NOT NULL CHECK (term BETWEEN 1 AND 3),
  amount_due       numeric(12,2) NOT NULL CHECK (amount_due > 0),
  amount_paid      numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  status           text NOT NULL DEFAULT 'unpaid'
                   CHECK (status IN ('unpaid', 'partial', 'paid', 'waived')),
  issued_at        timestamptz NOT NULL DEFAULT now(),
  due_date         date,
  row_version      bigint NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  UNIQUE (student_id, academic_year, term)
);
CREATE INDEX idx_invoices_student ON finance.invoices (student_id) WHERE deleted_at IS NULL;
SELECT core.make_syncable('finance.invoices');

CREATE TABLE finance.payments (
  id           uuid PRIMARY KEY,
  tenant_id    uuid NOT NULL REFERENCES core.tenants(id),
  invoice_id   uuid NOT NULL REFERENCES finance.invoices(id),
  amount       numeric(12,2) NOT NULL CHECK (amount > 0),
  method       text NOT NULL CHECK (method IN ('mpesa', 'bank', 'cash', 'cheque')),
  reference    text NOT NULL,          -- M-Pesa receipt no. / bank slip no. / checkout request id
  status       text NOT NULL DEFAULT 'confirmed'
               CHECK (status IN ('pending', 'confirmed', 'failed')),
  recorded_by  uuid REFERENCES core.users(id),  -- NULL for gateway-initiated (pending) rows
  paid_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (method, reference)            -- the same M-Pesa receipt cannot be applied twice
);
CREATE INDEX idx_payments_invoice ON finance.payments (invoice_id);
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON finance.payments
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

ALTER TABLE finance.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.payments FORCE ROW LEVEL SECURITY;
CREATE POLICY payments_tenant ON finance.payments
  TO elimubora_app
  USING (tenant_id = core.current_tenant_id())
  WITH CHECK (tenant_id = core.current_tenant_id());
GRANT SELECT, INSERT, UPDATE ON finance.payments TO elimubora_app;

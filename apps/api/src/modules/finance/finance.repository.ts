import { randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { AuditService } from '../../core/audit/audit.service';
import { DatabaseService } from '../../core/database/database.service';
import { OutboxService } from '../../core/outbox/outbox.service';
import { PAYMENT_GATEWAY, type PaymentGateway } from '../../core/payments/payment-gateway.port';
import type { FeeStructure, Invoice, Payment, PaymentMethod } from './finance.types';

const UNIQUE_VIOLATION = '23505';

interface FeeStructureRow {
  id: string;
  grade_level: string;
  academic_year: number;
  term: number;
  amount: string;
  description: string | null;
}
const toFeeStructure = (r: FeeStructureRow): FeeStructure => ({
  id: r.id,
  gradeLevel: r.grade_level,
  academicYear: r.academic_year,
  term: r.term,
  amount: r.amount,
  description: r.description
});

interface InvoiceRow {
  id: string;
  student_id: string;
  fee_structure_id: string;
  academic_year: number;
  term: number;
  amount_due: string;
  amount_paid: string;
  status: Invoice['status'];
  due_date: Date | null;
}
const toInvoice = (r: InvoiceRow): Invoice => ({
  id: r.id,
  studentId: r.student_id,
  feeStructureId: r.fee_structure_id,
  academicYear: r.academic_year,
  term: r.term,
  amountDue: r.amount_due,
  amountPaid: r.amount_paid,
  status: r.status,
  dueDate: r.due_date ? r.due_date.toISOString().slice(0, 10) : null
});

interface PaymentRow {
  id: string;
  invoice_id: string;
  amount: string;
  method: PaymentMethod;
  reference: string;
  status: Payment['status'];
  recorded_by: string | null;
  paid_at: Date | null;
}
const toPayment = (r: PaymentRow): Payment => ({
  id: r.id,
  invoiceId: r.invoice_id,
  amount: r.amount,
  method: r.method,
  reference: r.reference,
  status: r.status,
  recordedBy: r.recorded_by,
  paidAt: r.paid_at ? r.paid_at.toISOString() : null
});

@Injectable()
export class FinanceRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway
  ) {}

  // ---------------- fee structures ----------------

  async createFeeStructure(input: {
    gradeLevel: string;
    academicYear: number;
    term: number;
    amount: number;
    description?: string;
  }): Promise<FeeStructure> {
    return this.db.withTenantTransaction(async (client) => {
      const id = randomUUID();
      const { rows } = await client.query<FeeStructureRow>(
        `INSERT INTO finance.fee_structures
           (id, tenant_id, grade_level, academic_year, term, amount, description)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4, $5, $6)
         RETURNING *`,
        [id, input.gradeLevel, input.academicYear, input.term, input.amount, input.description ?? null]
      );
      await this.audit.record(client, {
        action: 'fee_structure.created',
        entityType: 'fee_structure',
        entityId: id,
        after: { gradeLevel: input.gradeLevel, term: input.term, amount: input.amount }
      });
      return toFeeStructure(rows[0]!);
    });
  }

  async findFeeStructure(id: string): Promise<FeeStructure | null> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<FeeStructureRow>(
        `SELECT * FROM finance.fee_structures
          WHERE id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL`,
        [id]
      );
      return rows[0] ? toFeeStructure(rows[0]) : null;
    });
  }

  /** All fee structures in the tenant — needed for the admin fees overview and the "create invoice" dropdown. */
  async listFeeStructures(): Promise<FeeStructure[]> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<FeeStructureRow>(
        `SELECT * FROM finance.fee_structures
          WHERE tenant_id = core.current_tenant_id() AND deleted_at IS NULL
          ORDER BY academic_year DESC, term, grade_level`
      );
      return rows.map(toFeeStructure);
    });
  }

  // ---------------- invoices ----------------

  async createInvoice(input: {
    studentId: string;
    feeStructureId: string;
    dueDate?: string;
  }): Promise<Invoice> {
    return this.db.withTenantTransaction(async (client) => {
      const fee = await client.query<FeeStructureRow>(
        `SELECT * FROM finance.fee_structures
          WHERE id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL`,
        [input.feeStructureId]
      );
      const structure = fee.rows[0];
      if (!structure) throw new NotFoundException('Fee structure not found');

      const id = randomUUID();
      const { rows } = await client.query<InvoiceRow>(
        `INSERT INTO finance.invoices
           (id, tenant_id, student_id, fee_structure_id, academic_year, term, amount_due, due_date)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          id,
          input.studentId,
          input.feeStructureId,
          structure.academic_year,
          structure.term,
          structure.amount,
          input.dueDate ?? null
        ]
      );
      await this.audit.record(client, {
        action: 'invoice.created',
        entityType: 'invoice',
        entityId: id,
        after: { studentId: input.studentId, amountDue: structure.amount }
      });
      await this.outbox.append(client, {
        aggregateType: 'invoice',
        aggregateId: id,
        eventType: 'invoice.created.v1',
        payload: { invoiceId: id, studentId: input.studentId, amountDue: structure.amount }
      });
      return toInvoice(rows[0]!);
    });
  }

  async findInvoice(id: string): Promise<Invoice | null> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<InvoiceRow>(
        `SELECT * FROM finance.invoices
          WHERE id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL`,
        [id]
      );
      return rows[0] ? toInvoice(rows[0]) : null;
    });
  }

  async listInvoicesForStudent(studentId: string): Promise<Invoice[]> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<InvoiceRow>(
        `SELECT * FROM finance.invoices
          WHERE student_id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL
          ORDER BY academic_year DESC, term DESC`,
        [studentId]
      );
      return rows.map(toInvoice);
    });
  }

  /**
   * Tenant-wide invoice list — the existing method above is
   * per-student, which has no way to answer "what's the overall fee
   * picture right now" for an admin. Joined with core.users since
   * Invoice itself only carries studentId, not a name.
   */
  async listInvoices(): Promise<Array<Invoice & { studentName: string }>> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<InvoiceRow & { student_name: string }>(
        `SELECT i.*, u.full_name AS student_name
           FROM finance.invoices i
           JOIN core.users u ON u.id = i.student_id
          WHERE i.tenant_id = core.current_tenant_id() AND i.deleted_at IS NULL
          ORDER BY i.academic_year DESC, i.term DESC, u.full_name`
      );
      return rows.map((r) => ({ ...toInvoice(r), studentName: r.student_name }));
    });
  }

  async listPaymentsForInvoice(invoiceId: string): Promise<Payment[]> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<PaymentRow>(
        `SELECT * FROM finance.payments
          WHERE invoice_id = $1 AND tenant_id = core.current_tenant_id()
          ORDER BY created_at`,
        [invoiceId]
      );
      return rows.map(toPayment);
    });
  }

  /** Financial Analytics: fee collection rate across every invoice for a year (optionally one term). */
  async getCollectionSummary(
    academicYear: number,
    term?: number
  ): Promise<{ totalInvoiced: string; totalCollected: string; invoiceCount: number }> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{
        total_invoiced: string | null;
        total_collected: string | null;
        n: string;
      }>(
        `SELECT COALESCE(SUM(amount_due), 0) AS total_invoiced,
                COALESCE(SUM(amount_paid), 0) AS total_collected,
                count(*)::int AS n
           FROM finance.invoices
          WHERE academic_year = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL
            AND ($2::smallint IS NULL OR term = $2)`,
        [academicYear, term ?? null]
      );
      const row = rows[0];
      return {
        totalInvoiced: row?.total_invoiced ?? '0',
        totalCollected: row?.total_collected ?? '0',
        invoiceCount: Number(row?.n ?? 0)
      };
    });
  }

  /**
   * Recomputes amount_paid as the sum of CONFIRMED payments and derives
   * status from it. Never trusts a client-supplied balance — this is
   * the only path that writes amount_paid/status, called after every
   * payment state change. A 'waived' invoice is left untouched.
   */
  private async recomputeInvoiceBalance(client: PoolClient, invoiceId: string): Promise<Invoice> {
    const { rows: sumRows } = await client.query<{ total: string }>(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM finance.payments
        WHERE invoice_id = $1 AND status = 'confirmed'`,
      [invoiceId]
    );
    const totalPaid = sumRows[0]!.total;
    const { rows } = await client.query<InvoiceRow>(
      `UPDATE finance.invoices
          SET amount_paid = $2,
              status = CASE
                WHEN status = 'waived' THEN status
                WHEN $2::numeric >= amount_due THEN 'paid'
                WHEN $2::numeric > 0 THEN 'partial'
                ELSE 'unpaid' END
        WHERE id = $1
        RETURNING *`,
      [invoiceId, totalPaid]
    );
    return toInvoice(rows[0]!);
  }

  // ---------------- payments ----------------

  async recordManualPayment(input: {
    invoiceId: string;
    amount: number;
    method: Exclude<PaymentMethod, 'mpesa'>;
    reference: string;
    recordedBy: string;
  }): Promise<{ payment: Payment; invoice: Invoice }> {
    try {
      return await this.db.withTenantTransaction(async (client) => {
        const id = randomUUID();
        const { rows } = await client.query<PaymentRow>(
          `INSERT INTO finance.payments
             (id, tenant_id, invoice_id, amount, method, reference, status, recorded_by, paid_at)
           VALUES ($1, core.current_tenant_id(), $2, $3, $4, $5, 'confirmed', $6, now())
           RETURNING *`,
          [id, input.invoiceId, input.amount, input.method, input.reference, input.recordedBy]
        );
        await this.audit.record(client, {
          action: 'payment.recorded',
          entityType: 'payment',
          entityId: id,
          after: { method: input.method, amount: input.amount }
        });
        const invoice = await this.recomputeInvoiceBalance(client, input.invoiceId);
        if (invoice.status === 'paid') {
          await this.outbox.append(client, {
            aggregateType: 'invoice',
            aggregateId: invoice.id,
            eventType: 'invoice.paid.v1',
            payload: { invoiceId: invoice.id, studentId: invoice.studentId }
          });
        }
        return { payment: toPayment(rows[0]!), invoice };
      });
    } catch (err) {
      const pgErr = err as { code?: string };
      if (pgErr.code === UNIQUE_VIOLATION) {
        throw new ConflictException(
          'A payment with this reference has already been recorded — duplicate submission blocked.'
        );
      }
      throw err;
    }
  }

  /** Starts an M-Pesa payment via the gateway port — see payment-gateway.port.ts for the sandbox disclaimer. */
  async initiateMpesaPayment(input: {
    invoiceId: string;
    amount: number;
    phone: string;
  }): Promise<Payment> {
    const { reference } = await this.gateway.initiate({
      amount: input.amount,
      phone: input.phone,
      accountReference: input.invoiceId
    });
    return this.db.withTenantTransaction(async (client) => {
      const id = randomUUID();
      const { rows } = await client.query<PaymentRow>(
        `INSERT INTO finance.payments
           (id, tenant_id, invoice_id, amount, method, reference, status)
         VALUES ($1, core.current_tenant_id(), $2, $3, 'mpesa', $4, 'pending')
         RETURNING *`,
        [id, input.invoiceId, input.amount, reference]
      );
      await this.audit.record(client, {
        action: 'payment.mpesa_initiated',
        entityType: 'payment',
        entityId: id,
        after: { reference }
      });
      return toPayment(rows[0]!);
    });
  }

  /**
   * Applied when the gateway confirms (in production: Safaricom's
   * callback). Looks up the payment by its gateway reference — the
   * webhook never receives or trusts an invoice id or tenant id
   * directly from the caller, only the opaque reference it itself issued.
   */
  async confirmGatewayPayment(
    reference: string,
    status: 'confirmed' | 'failed'
  ): Promise<{ payment: Payment; invoice: Invoice } | null> {
    return this.db.withContext({}, async (client) => {
      // Gateway callbacks arrive with no tenant context — the reference
      // is globally unique (UNIQUE(method, reference)), but finance.payments
      // is FORCE RLS, so a plain SELECT here would see zero rows
      // regardless of whether a match exists (tenant_id = NULL never
      // matches). The SECURITY DEFINER function from migration 0010
      // looks the row up pre-context, exactly like identity's
      // pre-auth lookups; the tenant it returns is then bound for the
      // remainder of this transaction to satisfy RLS on the UPDATE.
      const found = await client.query<{
        id: string;
        tenant_id: string;
        invoice_id: string;
        amount: string;
      }>('SELECT * FROM finance.lookup_pending_mpesa_payment($1)', [reference]);
      const row = found.rows[0];
      if (!row) return null;
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [row.tenant_id]);

      const { rows } = await client.query<PaymentRow>(
        `UPDATE finance.payments SET status = $2, paid_at = CASE WHEN $2 = 'confirmed' THEN now() ELSE paid_at END
          WHERE id = $1
          RETURNING *`,
        [row.id, status]
      );
      await this.audit.record(client, {
        action: 'payment.gateway_confirmed',
        entityType: 'payment',
        entityId: row.id,
        after: { status }
      });
      const invoice =
        status === 'confirmed' ? await this.recomputeInvoiceBalance(client, row.invoice_id) : null;
      if (invoice?.status === 'paid') {
        await this.outbox.append(client, {
          aggregateType: 'invoice',
          aggregateId: invoice.id,
          eventType: 'invoice.paid.v1',
          payload: { invoiceId: invoice.id, studentId: invoice.studentId }
        });
      }
      return {
        payment: toPayment(rows[0]!),
        invoice: invoice ?? (await this.getInvoiceUnscoped(client, row.invoice_id))
      };
    });
  }

  private async getInvoiceUnscoped(client: PoolClient, invoiceId: string): Promise<Invoice> {
    const { rows } = await client.query<InvoiceRow>('SELECT * FROM finance.invoices WHERE id = $1', [
      invoiceId
    ]);
    return toInvoice(rows[0]!);
  }
}

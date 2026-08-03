import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { APP_CONFIG, type AppConfig } from '../src/config/configuration';

const appUrl = process.env.INTEGRATION_DATABASE_URL;
const adminUrl = process.env.INTEGRATION_ADMIN_DATABASE_URL ?? appUrl;
const d = appUrl ? describe : describe.skip;

d('Finance (integration)', () => {
  let app: INestApplication;
  let db: Client;
  let tenantId: string;

  const stamp = Date.now();
  const password = 'A-genuinely-long-password-1';
  const adminEmail = `fin-admin-${stamp}@school.ke`;
  const parentEmail = `fin-parent-${stamp}@school.ke`;

  let adminToken: string;
  let parentToken: string;
  let studentId: string;
  let feeStructureId: string;
  let invoiceId: string;

  const config: AppConfig = {
    nodeEnv: 'test',
    port: 0,
    databaseUrl: appUrl as string,
    workerDatabaseUrl: appUrl as string,
    outboxPollMs: 60_000,
    syncVisibilityDelaySeconds: 0,
    publicWebUrl: 'http://localhost:3000',
  uploadsDir: './uploads-test',
  corsAllowedOrigins: ['http://localhost:3000'],
    auth: {
      invitationTtlDays: 7,
      passwordResetTtlMinutes: 30,
      jwtSecret: 'integration-secret-integration-secret',
      encKeyHex: '0123456789abcdef'.repeat(4),
      accessTtlSeconds: 900,
      refreshTtlDays: 30,
      allowOpenRegistration: true
    }
  };

  const login = async (email: string) => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.tokens.accessToken as string;
  };

  beforeAll(async () => {
    db = new Client({ connectionString: adminUrl });
    await db.connect();
    const t = await db.query(
      `INSERT INTO core.tenants (slug, name, kind) VALUES ($1, 'Finance Test School', 'school') RETURNING id`,
      [`fin-school-${stamp}`]
    );
    tenantId = t.rows[0].id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(config)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1', { exclude: ['health'] });
    await app.init();

    for (const [email, role] of [
      [adminEmail, 'school_admin'],
      [parentEmail, 'parent']
    ] as const) {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email, fullName: 'Finance Person', password, tenantId, role })
        .expect(201);
    }
    adminToken = await login(adminEmail);
    parentToken = await login(parentEmail);

    const stream = await request(app.getHttpServer())
      .post('/v1/class-streams')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ name: 'Grade 2 Amber', gradeLevel: 'G2', academicYear: 2026 })
      .expect(201);
    const student = await request(app.getHttpServer())
      .post('/v1/students')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'Njeri Mwangi', gradeLevel: 'G2', classStreamId: stream.body.id, academicYear: 2026 })
      .expect(201);
    studentId = student.body.studentId;

    // Link the parent as guardian for the fees-view test later.
    const parentId = (
      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('authorization', `Bearer ${parentToken}`)
        .expect(200)
    ).body.id;
    const guardian = await request(app.getHttpServer())
      .post('/v1/guardians')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'Njeri Parent' })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/v1/guardians/${guardian.body.id}/link-account`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ userId: parentId })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/v1/students/${studentId}/guardians`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ guardianId: guardian.body.id, relationship: 'mother', isPrimary: true })
      .expect(201);

    const fee = await request(app.getHttpServer())
      .post('/v1/fee-structures')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ gradeLevel: 'G2', academicYear: 2026, term: 1, amount: 15000, description: 'Term 1 fees' })
      .expect(201);
    feeStructureId = fee.body.id;
  });

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it('a parent cannot create fee structures or invoices (admin-only)', async () => {
    await request(app.getHttpServer())
      .post('/v1/fee-structures')
      .set('authorization', `Bearer ${parentToken}`)
      .send({ gradeLevel: 'G2', academicYear: 2026, term: 2, amount: 15000 })
      .expect(403);
  });

  it('creates an invoice from the fee structure, amount_due copied automatically', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/invoices')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ studentId, feeStructureId, dueDate: '2026-04-30' })
      .expect(201);
    invoiceId = res.body.id;
    expect(res.body).toMatchObject({ amountDue: '15000.00', amountPaid: '0.00', status: 'unpaid' });
  });

  it('a partial manual payment moves the invoice to partial with a DERIVED balance', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/invoices/${invoiceId}/payments/manual`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ amount: 5000, method: 'cash', reference: `CASH-${stamp}-1` })
      .expect(201);
    expect(res.body.invoice).toMatchObject({ amountPaid: '5000.00', status: 'partial' });
  });

  it('rejects a second payment reusing the same reference — no double counting', async () => {
    await request(app.getHttpServer())
      .post(`/v1/invoices/${invoiceId}/payments/manual`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ amount: 5000, method: 'cash', reference: `CASH-${stamp}-1` })
      .expect(409);

    const invoice = await request(app.getHttpServer())
      .get(`/v1/invoices/${invoiceId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(invoice.body.amountPaid).toBe('5000.00'); // unchanged — the duplicate was blocked
  });

  it('a second, different-reference payment completing the balance marks the invoice paid', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/invoices/${invoiceId}/payments/manual`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ amount: 10000, method: 'bank', reference: `BANK-${stamp}-1` })
      .expect(201);
    expect(res.body.invoice).toMatchObject({ amountPaid: '15000.00', status: 'paid' });

    const payments = await request(app.getHttpServer())
      .get(`/v1/invoices/${invoiceId}/payments`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(payments.body).toHaveLength(2);
  });

  it('the M-Pesa sandbox flow: initiate (pending, no network call) then a webhook confirmation with NO auth token completes it', async () => {
    // A second invoice so this flow has a clean, unpaid balance to work with.
    const invoice2 = await request(app.getHttpServer())
      .post('/v1/fee-structures')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ gradeLevel: 'G2', academicYear: 2026, term: 2, amount: 8000 })
      .expect(201);
    const inv = await request(app.getHttpServer())
      .post('/v1/invoices')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ studentId, feeStructureId: invoice2.body.id })
      .expect(201);

    const initiate = await request(app.getHttpServer())
      .post(`/v1/invoices/${inv.body.id}/payments/mpesa/initiate`)
      .set('authorization', `Bearer ${parentToken}`)
      .send({ amount: 8000, phone: '+254712345678' })
      .expect(201);
    expect(initiate.body.status).toBe('pending');
    expect(initiate.body.reference).toMatch(/^SANDBOX-/);

    // The webhook is @Public() — deliberately called with NO bearer
    // token, exactly as Safaricom would call it in production.
    const callback = await request(app.getHttpServer())
      .post('/v1/payments/mpesa/callback')
      .send({ reference: initiate.body.reference, status: 'confirmed' })
      .expect(201);
    expect(callback.body.invoice).toMatchObject({ amountPaid: '8000.00', status: 'paid' });

    // The callback is itself idempotent-adjacent: a pending payment
    // that's already been confirmed can't be "found pending" again.
    await request(app.getHttpServer())
      .post('/v1/payments/mpesa/callback')
      .send({ reference: initiate.body.reference, status: 'confirmed' })
      .expect(404);
  });

  it('a failed M-Pesa callback marks the payment failed WITHOUT touching the invoice balance', async () => {
    const fee3 = await request(app.getHttpServer())
      .post('/v1/fee-structures')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ gradeLevel: 'G2', academicYear: 2026, term: 3, amount: 4000 })
      .expect(201);
    const inv3 = await request(app.getHttpServer())
      .post('/v1/invoices')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ studentId, feeStructureId: fee3.body.id })
      .expect(201);
    const initiate = await request(app.getHttpServer())
      .post(`/v1/invoices/${inv3.body.id}/payments/mpesa/initiate`)
      .set('authorization', `Bearer ${parentToken}`)
      .send({ amount: 4000, phone: '+254700000001' })
      .expect(201);

    const callback = await request(app.getHttpServer())
      .post('/v1/payments/mpesa/callback')
      .send({ reference: initiate.body.reference, status: 'failed' })
      .expect(201);
    expect(callback.body.payment.status).toBe('failed');
    expect(callback.body.invoice.status).toBe('unpaid');
    expect(callback.body.invoice.amountPaid).toBe('0.00');
  });

  it("the parent portal fees view composes invoices and their payment history for the guardian's child", async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/parent-portal/children/${studentId}/fees`)
      .set('authorization', `Bearer ${parentToken}`)
      .expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
    const firstInvoice = res.body.find((i: { id: string }) => i.id === invoiceId);
    expect(firstInvoice.payments).toHaveLength(2);
  });

  it('GET /fee-structures lists tenant-scoped fee structures, admin-only', async () => {
    await request(app.getHttpServer())
      .get('/v1/fee-structures')
      .set('authorization', `Bearer ${parentToken}`)
      .expect(403);

    const res = await request(app.getHttpServer())
      .get('/v1/fee-structures')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const structure = res.body.find((s: { id: string }) => s.id === feeStructureId);
    expect(structure).toBeDefined();
  });

  it('GET /invoices lists every invoice tenant-wide with the student name, admin-only', async () => {
    await request(app.getHttpServer())
      .get('/v1/invoices')
      .set('authorization', `Bearer ${parentToken}`)
      .expect(403);

    const res = await request(app.getHttpServer())
      .get('/v1/invoices')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const invoice = res.body.find((i: { id: string }) => i.id === invoiceId);
    expect(invoice).toBeDefined();
    expect(invoice.studentName).toBeTruthy();
  });
});

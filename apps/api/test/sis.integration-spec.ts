import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { APP_CONFIG, type AppConfig } from '../src/config/configuration';

const appUrl = process.env.INTEGRATION_DATABASE_URL;
const adminUrl = process.env.INTEGRATION_ADMIN_DATABASE_URL ?? appUrl;
const d = appUrl ? describe : describe.skip;

d('Student Information System (integration)', () => {
  let app: INestApplication;
  let db: Client;
  let tenantA: string;
  let tenantB: string;

  const stamp = Date.now();
  const password = 'A-genuinely-long-password-1';
  const adminAEmail = `sis-admin-a-${stamp}@school.ke`;
  const adminBEmail = `sis-admin-b-${stamp}@school.ke`;
  const teacherEmail = `sis-teacher-${stamp}@school.ke`;

  let adminAToken: string;
  let adminBToken: string;
  let teacherToken: string;
  let classStreamId: string;
  let studentId: string;
  let transferId: string;

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
      `INSERT INTO core.tenants (slug, name, kind) VALUES
         ($1, 'SIS School A', 'school'), ($2, 'SIS School B', 'school')
       RETURNING id`,
      [`sis-a-${stamp}`, `sis-b-${stamp}`]
    );
    tenantA = t.rows[0].id;
    tenantB = t.rows[1].id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(config)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1', { exclude: ['health'] });
    await app.init();

    for (const [email, tenantId, role] of [
      [adminAEmail, tenantA, 'school_admin'],
      [adminBEmail, tenantB, 'school_admin'],
      [teacherEmail, tenantA, 'teacher']
    ] as const) {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email, fullName: 'SIS Staff', password, tenantId, role })
        .expect(201);
    }
    adminAToken = await login(adminAEmail);
    adminBToken = await login(adminBEmail);
    teacherToken = await login(teacherEmail);

    const stream = await request(app.getHttpServer())
      .post('/v1/class-streams')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Grade 4 Blue', gradeLevel: 'G4', academicYear: 2026 })
      .expect(201);
    classStreamId = stream.body.id;
  });

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it('a teacher cannot enroll a student (admin-only orchestration)', async () => {
    await request(app.getHttpServer())
      .post('/v1/students')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({
        fullName: 'Wanjiru Kamau',
        gradeLevel: 'G4',
        classStreamId,
        academicYear: 2026
      })
      .expect(403);
  });

  it('enrolling a student provisions a real system identity and allocates a class', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/students')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({
        fullName: 'Wanjiru Kamau',
        dateOfBirth: '2017-03-14',
        gender: 'female',
        gradeLevel: 'G4',
        classStreamId,
        academicYear: 2026
      })
      .expect(201);
    studentId = res.body.studentId;
    expect(res.body.status).toBe('active');
    expect(res.body.admissionNumber).toMatch(/^2026-[0-9A-F]{6}$/);

    // The provisioned identity is a real core.users row with a membership.
    // Read via the app role with a bound context — FORCE RLS blocks even
    // the table-owner connection (the recurring lesson from ADR-006/007).
    const appRead = new Client({ connectionString: appUrl });
    await appRead.connect();
    await appRead.query("SELECT set_config('app.tenant_id', $1, false)", [tenantA]);
    const { rows } = await appRead.query(
      `SELECT role FROM core.memberships WHERE user_id = $1 AND tenant_id = core.current_tenant_id()`,
      [studentId]
    );
    await appRead.end();
    expect(rows).toEqual([{ role: 'learner' }]);

    const roster = await request(app.getHttpServer())
      .get(`/v1/class-streams/${classStreamId}/roster`)
      .set('authorization', `Bearer ${adminAToken}`)
      .expect(200);
    expect(roster.body).toEqual([
      expect.objectContaining({ studentId, admissionNumber: res.body.admissionNumber })
    ]);
  });

  it('medical records are restricted to administrative roles, not teachers', async () => {
    await request(app.getHttpServer())
      .patch(`/v1/students/${studentId}/medical`)
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ bloodGroup: 'O+', allergies: 'Penicillin' })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/v1/students/${studentId}/medical`)
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(403);

    const asAdmin = await request(app.getHttpServer())
      .get(`/v1/students/${studentId}/medical`)
      .set('authorization', `Bearer ${adminAToken}`)
      .expect(200);
    expect(asAdmin.body).toMatchObject({ bloodGroup: 'O+', allergies: 'Penicillin' });
  });

  it('a guardian can be linked and retrieved', async () => {
    const guardian = await request(app.getHttpServer())
      .post('/v1/guardians')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ fullName: 'Mary Kamau', phone: '+254712345678' })
      .expect(201);

    const linked = await request(app.getHttpServer())
      .post(`/v1/students/${studentId}/guardians`)
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ guardianId: guardian.body.id, relationship: 'mother', isPrimary: true })
      .expect(201);
    expect(linked.body).toEqual([
      expect.objectContaining({ fullName: 'Mary Kamau', userId: null })
    ]);
  });

  it('a school cannot transfer a student to itself', async () => {
    await request(app.getHttpServer())
      .post(`/v1/students/${studentId}/transfers`)
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ toTenantId: tenantA })
      .expect(400);
  });

  it('requests a cross-tenant transfer, visible to both schools via RLS', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/students/${studentId}/transfers`)
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ toTenantId: tenantB, reason: 'Family relocation' })
      .expect(201);
    transferId = res.body.id;
    expect(res.body.status).toBe('pending');

    // Both the sending and receiving admin can see it — the two-sided
    // RLS policy, not a single tenant_id column.
    await request(app.getHttpServer())
      .get(`/v1/transfers/${transferId}`)
      .set('authorization', `Bearer ${adminAToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/v1/transfers/${transferId}`)
      .set('authorization', `Bearer ${adminBToken}`)
      .expect(200);
  });

  it('only the RECEIVING school can decide the transfer — the sender cannot self-approve', async () => {
    await request(app.getHttpServer())
      .patch(`/v1/transfers/${transferId}/decision`)
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ status: 'accepted' })
      .expect(403);

    const decided = await request(app.getHttpServer())
      .patch(`/v1/transfers/${transferId}/decision`)
      .set('authorization', `Bearer ${adminBToken}`)
      .send({ status: 'accepted' })
      .expect(200);
    expect(decided.body.status).toBe('accepted');

    // A decided transfer cannot be decided again.
    await request(app.getHttpServer())
      .patch(`/v1/transfers/${transferId}/decision`)
      .set('authorization', `Bearer ${adminBToken}`)
      .send({ status: 'rejected' })
      .expect(400);
  });

  it('accepting the transfer marks the source profile transferred_out', async () => {
    const appRead = new Client({ connectionString: appUrl });
    await appRead.connect();
    await appRead.query("SELECT set_config('app.tenant_id', $1, false)", [tenantA]);
    const { rows } = await appRead.query(
      `SELECT status FROM sis.student_profiles WHERE student_id = $1 AND tenant_id = core.current_tenant_id()`,
      [studentId]
    );
    await appRead.end();
    expect(rows[0].status).toBe('transferred_out');
  });

  it('a school outside both sides of the transfer cannot see it', async () => {
    const t3 = await db.query(
      `INSERT INTO core.tenants (slug, name, kind) VALUES ($1, 'SIS School C', 'school') RETURNING id`,
      [`sis-c-${stamp}`]
    );
    const cEmail = `sis-admin-c-${stamp}@school.ke`;
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email: cEmail, fullName: 'C Admin', password, tenantId: t3.rows[0].id, role: 'school_admin' })
      .expect(201);
    const cToken = await login(cEmail);
    await request(app.getHttpServer())
      .get(`/v1/transfers/${transferId}`)
      .set('authorization', `Bearer ${cToken}`)
      .expect(404);
  });

  it('graduating a student updates status and is admin-only', async () => {
    // Enroll a fresh student in school B to graduate (the original was transferred, not graduated).
    const streamB = await request(app.getHttpServer())
      .post('/v1/class-streams')
      .set('authorization', `Bearer ${adminBToken}`)
      .send({ name: 'Grade 8 Green', gradeLevel: 'G8', academicYear: 2026 })
      .expect(201);
    const grad = await request(app.getHttpServer())
      .post('/v1/students')
      .set('authorization', `Bearer ${adminBToken}`)
      .send({ fullName: 'Otieno Omondi', gradeLevel: 'G8', classStreamId: streamB.body.id, academicYear: 2026 })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/students/${grad.body.studentId}/graduate`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ cohortYear: 2026 })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/v1/students/${grad.body.studentId}/graduate`)
      .set('authorization', `Bearer ${adminBToken}`)
      .send({ cohortYear: 2026 })
      .expect(201);

    const profile = await request(app.getHttpServer())
      .get(`/v1/students/${grad.body.studentId}`)
      .set('authorization', `Bearer ${adminBToken}`)
      .expect(200);
    expect(profile.body.status).toBe('graduated');
  });

  it('GET /class-streams lists tenant-scoped class streams, admin-only', async () => {
    await request(app.getHttpServer())
      .get('/v1/class-streams')
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(403);

    const res = await request(app.getHttpServer())
      .get('/v1/class-streams')
      .set('authorization', `Bearer ${adminAToken}`)
      .expect(200);
    const stream = res.body.find((s: { id: string }) => s.id === classStreamId);
    expect(stream).toMatchObject({ name: 'Grade 4 Blue', gradeLevel: 'G4' });
  });

  it('GET /students lists tenant-scoped students with name and current class, admin-only', async () => {
    // A dedicated, freshly-enrolled student — not the shared studentId
    // fixture, whose status/class allocation earlier tests in this
    // file have already mutated (transferred out) by this point.
    const dedicatedStream = await request(app.getHttpServer())
      .post('/v1/class-streams')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Grade 5 Listing Test', gradeLevel: 'G5', academicYear: 2026 })
      .expect(201);
    const dedicatedStudent = await request(app.getHttpServer())
      .post('/v1/students')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({
        fullName: 'Listing Test Student',
        gradeLevel: 'G5',
        classStreamId: dedicatedStream.body.id,
        academicYear: 2026
      })
      .expect(201);

    await request(app.getHttpServer())
      .get('/v1/students')
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(403);

    const res = await request(app.getHttpServer())
      .get('/v1/students')
      .set('authorization', `Bearer ${adminAToken}`)
      .expect(200);
    const student = res.body.find(
      (s: { studentId: string }) => s.studentId === dedicatedStudent.body.studentId
    );
    expect(student).toBeDefined();
    expect(student.fullName).toBe('Listing Test Student');
    expect(student.className).toBe('Grade 5 Listing Test');
    expect(student.gradeLevel).toBe('G5');
    expect(student.status).toBe('active');

    // Tenant B's admin sees none of tenant A's students — real RLS isolation, not just a filter.
    const resB = await request(app.getHttpServer())
      .get('/v1/students')
      .set('authorization', `Bearer ${adminBToken}`)
      .expect(200);
    expect(
      resB.body.find((s: { studentId: string }) => s.studentId === dedicatedStudent.body.studentId)
    ).toBeUndefined();
  });

  it('submits an admission application, admin-only', async () => {
    await request(app.getHttpServer())
      .post('/v1/admissions')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({
        candidateName: 'Kevin Otieno',
        guardianName: 'Mary Otieno',
        guardianPhone: '0712345678',
        gradeLevelApplied: 'G3'
      })
      .expect(403);

    const res = await request(app.getHttpServer())
      .post('/v1/admissions')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({
        candidateName: 'Kevin Otieno',
        guardianName: 'Mary Otieno',
        guardianPhone: '0712345678',
        gradeLevelApplied: 'G3'
      })
      .expect(201);
    expect(res.body.status).toBe('submitted');
  });

  it('GET /admissions lists tenant-scoped applications, admin-only, and a decision updates status', async () => {
    const app1 = await request(app.getHttpServer())
      .post('/v1/admissions')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({
        candidateName: 'Listing Test Candidate',
        guardianName: 'Guardian Name',
        guardianPhone: '0700000000',
        gradeLevelApplied: 'G2'
      })
      .expect(201);

    await request(app.getHttpServer())
      .get('/v1/admissions')
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(403);

    const listed = await request(app.getHttpServer())
      .get('/v1/admissions')
      .set('authorization', `Bearer ${adminAToken}`)
      .expect(200);
    const found = listed.body.find((a: { id: string }) => a.id === app1.body.id);
    expect(found).toBeDefined();
    expect(found.status).toBe('submitted');

    // Tenant B's admin sees none of tenant A's applications — real RLS isolation.
    const listedB = await request(app.getHttpServer())
      .get('/v1/admissions')
      .set('authorization', `Bearer ${adminBToken}`)
      .expect(200);
    expect(listedB.body.find((a: { id: string }) => a.id === app1.body.id)).toBeUndefined();

    await request(app.getHttpServer())
      .patch(`/v1/admissions/${app1.body.id}/decision`)
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ status: 'admitted', notes: 'Strong interview' })
      .expect(200);

    const afterDecision = await request(app.getHttpServer())
      .get('/v1/admissions')
      .set('authorization', `Bearer ${adminAToken}`)
      .expect(200);
    const decided = afterDecision.body.find((a: { id: string }) => a.id === app1.body.id);
    expect(decided.status).toBe('admitted');
    expect(decided.notes).toBe('Strong interview');
  });
});

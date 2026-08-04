import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyGlobalAppConfig } from '../src/bootstrap';
import { APP_CONFIG, type AppConfig } from '../src/config/configuration';

const appUrl = process.env.INTEGRATION_DATABASE_URL;
const adminUrl = process.env.INTEGRATION_ADMIN_DATABASE_URL ?? appUrl;
const d = appUrl ? describe : describe.skip;

d('Mobile (integration)', () => {
  let app: INestApplication;
  let db: Client;
  let tenantId: string;
  let tenantBId: string;

  const stamp = Date.now();
  const password = 'A-genuinely-long-password-1';
  const year = 2026;

  let teacherToken: string;
  let learnerToken: string;
  let otherLearnerToken: string;
  let otherTenantTeacherToken: string;
  let classStreamId: string;
  let learnerId: string;

  const config: AppConfig = {
    nodeEnv: 'test',
    port: 0,
    databaseUrl: appUrl as string,
    workerDatabaseUrl: 'postgres://elimubora_worker:worker_dev_password@localhost:5432/elimubora',
    outboxPollMs: 60_000,
    syncVisibilityDelaySeconds: 0,
    publicWebUrl: 'http://localhost:3000',
    uploadsDir: `./uploads-test-mobile-${Date.now()}`,
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
         ($1, 'Mobile Test School', 'school'), ($2, 'Mobile Test School B', 'school')
       RETURNING id`,
      [`mobile-school-${stamp}`, `mobile-school-b-${stamp}`]
    );
    tenantId = t.rows[0].id;
    tenantBId = t.rows[1].id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(config)
      .compile();
    app = moduleRef.createNestApplication();
    applyGlobalAppConfig(app, config);
    await app.init();

    const teacherEmail = `mob-teacher-${stamp}@school.ke`;
    const learnerEmail = `mob-learner-${stamp}@school.ke`;
    const otherLearnerEmail = `mob-learner2-${stamp}@school.ke`;
    const otherTenantTeacherEmail = `mob-teacher-b-${stamp}@school.ke`;
    for (const [email, tid, role] of [
      [teacherEmail, tenantId, 'teacher'],
      [learnerEmail, tenantId, 'learner'],
      [otherLearnerEmail, tenantId, 'learner'],
      [otherTenantTeacherEmail, tenantBId, 'teacher']
    ] as const) {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email, fullName: 'Mobile Person', password, tenantId: tid, role })
        .expect(201);
    }
    teacherToken = await login(teacherEmail);
    learnerToken = await login(learnerEmail);
    otherLearnerToken = await login(otherLearnerEmail);
    otherTenantTeacherToken = await login(otherTenantTeacherEmail);

    learnerId = (
      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('authorization', `Bearer ${learnerToken}`)
        .expect(200)
    ).body.id;

    // Class stream creation is admin-only (SIS, Sprint 5) — a teacher cannot.
    await request(app.getHttpServer())
      .post('/v1/class-streams')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ name: 'Grade 5 Mobile', gradeLevel: 'G5', academicYear: year })
      .expect(403);

    const adminEmail = `mob-admin-${stamp}@school.ke`;
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email: adminEmail, fullName: 'Mobile Admin', password, tenantId, role: 'school_admin' })
      .expect(201);
    const adminToken = await login(adminEmail);
    const createdStream = await request(app.getHttpServer())
      .post('/v1/class-streams')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ name: 'Grade 5 Mobile', gradeLevel: 'G5', academicYear: year })
      .expect(201);
    classStreamId = createdStream.body.id;
  }, 30_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it('registers and unregisters a device token', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/mobile/devices')
      .set('authorization', `Bearer ${learnerToken}`)
      .send({ platform: 'android', pushToken: `fcm-token-${stamp}-1` })
      .expect(201);
    expect(res.body.platform).toBe('android');

    await request(app.getHttpServer())
      .post('/v1/mobile/devices/unregister')
      .set('authorization', `Bearer ${learnerToken}`)
      .send({ pushToken: `fcm-token-${stamp}-1` })
      .expect(204);
  });

  it('REAL FILE ROUND-TRIP: uploads a photo, then retrieves the exact same bytes back from local disk', async () => {
    const original = Buffer.from('not really a jpeg but real bytes for this test', 'utf8');
    const upload = await request(app.getHttpServer())
      .post('/v1/mobile/uploads')
      .set('authorization', `Bearer ${learnerToken}`)
      .send({ contentType: 'image/jpeg', dataBase64: original.toString('base64') })
      .expect(201);
    expect(upload.body.sizeBytes).toBe(original.length);
    expect(upload.body.storageKey).toMatch(/\.jpg$/);

    const retrieved = await request(app.getHttpServer())
      .get(`/v1/mobile/uploads/${upload.body.storageKey}`)
      .set('authorization', `Bearer ${learnerToken}`)
      .buffer()
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(retrieved.headers['content-type']).toBe('image/jpeg');
    expect(Buffer.compare(retrieved.body, original)).toBe(0);
  });

  it('a school in a different tenant cannot retrieve this upload — RLS isolation on the metadata lookup', async () => {
    const upload = await request(app.getHttpServer())
      .post('/v1/mobile/uploads')
      .set('authorization', `Bearer ${learnerToken}`)
      .send({ contentType: 'image/png', dataBase64: Buffer.from('tenant-scoped').toString('base64') })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/v1/mobile/uploads/${upload.body.storageKey}`)
      .set('authorization', `Bearer ${otherTenantTeacherToken}`)
      .expect(404);
  });

  it('rejects an upload over the size limit', async () => {
    const big = Buffer.alloc(9 * 1024 * 1024, 1);
    await request(app.getHttpServer())
      .post('/v1/mobile/uploads')
      .set('authorization', `Bearer ${learnerToken}`)
      .send({ contentType: 'image/jpeg', dataBase64: big.toString('base64') })
      .expect(400);
  });

  it('a learner cannot start an attendance QR session (staff-only)', async () => {
    await request(app.getHttpServer())
      .post('/v1/mobile/attendance-qr/session')
      .set('authorization', `Bearer ${learnerToken}`)
      .send({ classStreamId, attendanceDate: `${year}-04-01` })
      .expect(403);
  });

  it('SELF-SERVICE QR CHECK-IN: a teacher starts a session, the learner scans it and marks themselves present', async () => {
    const session = await request(app.getHttpServer())
      .post('/v1/mobile/attendance-qr/session')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ classStreamId, attendanceDate: `${year}-04-01` })
      .expect(201);
    expect(typeof session.body.token).toBe('string');

    await request(app.getHttpServer())
      .post('/v1/mobile/attendance-qr/redeem')
      .set('authorization', `Bearer ${learnerToken}`)
      .send({ token: session.body.token })
      .expect(204);

    const attendance = await request(app.getHttpServer())
      .get(`/v1/attendance/class/${classStreamId}`)
      .query({ date: `${year}-04-01` })
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(200);
    const record = attendance.body.find((r: { learnerId: string }) => r.learnerId === learnerId);
    expect(record).toMatchObject({ status: 'present' });
  });

  it('a forged/garbage QR token is rejected, not silently accepted', async () => {
    await request(app.getHttpServer())
      .post('/v1/mobile/attendance-qr/redeem')
      .set('authorization', `Bearer ${otherLearnerToken}`)
      .send({ token: 'this-is-not-a-real-signed-token' })
      .expect(401);
  });

  it('a school admin cannot redeem QR as a learner (role-gated to learner for self-service)', async () => {
    const session = await request(app.getHttpServer())
      .post('/v1/mobile/attendance-qr/session')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ classStreamId, attendanceDate: `${year}-04-02` })
      .expect(201);
    await request(app.getHttpServer())
      .post('/v1/mobile/attendance-qr/redeem')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ token: session.body.token })
      .expect(403);
  });

  it("TEACHER-SCAN VARIANT: staff can check in a young learner's shadow account by badge scan", async () => {
    const adminEmail = `mob-admin2-${stamp}@school.ke`;
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email: adminEmail, fullName: 'Mobile Admin 2', password, tenantId, role: 'school_admin' })
      .expect(201);
    const adminToken = await login(adminEmail);
    const shadowLearner = await request(app.getHttpServer())
      .post('/v1/students')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'Young Learner', gradeLevel: 'G5', classStreamId, academicYear: year })
      .expect(201);

    const session = await request(app.getHttpServer())
      .post('/v1/mobile/attendance-qr/session')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ classStreamId, attendanceDate: `${year}-04-03` })
      .expect(201);

    await request(app.getHttpServer())
      .post('/v1/mobile/attendance-qr/redeem-for')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ token: session.body.token, studentId: shadowLearner.body.studentId })
      .expect(204);

    const attendance = await request(app.getHttpServer())
      .get(`/v1/attendance/class/${classStreamId}`)
      .query({ date: `${year}-04-03` })
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(200);
    const record = attendance.body.find(
      (r: { learnerId: string }) => r.learnerId === shadowLearner.body.studentId
    );
    expect(record).toMatchObject({ status: 'present' });
  });

  it('a learner cannot use the teacher-scan variant', async () => {
    const session = await request(app.getHttpServer())
      .post('/v1/mobile/attendance-qr/session')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ classStreamId, attendanceDate: `${year}-04-04` })
      .expect(201);
    await request(app.getHttpServer())
      .post('/v1/mobile/attendance-qr/redeem-for')
      .set('authorization', `Bearer ${learnerToken}`)
      .send({ token: session.body.token, studentId: learnerId })
      .expect(403);
  });
});

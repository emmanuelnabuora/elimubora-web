import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { APP_CONFIG, type AppConfig } from '../src/config/configuration';

const appUrl = process.env.INTEGRATION_DATABASE_URL;
const adminUrl = process.env.INTEGRATION_ADMIN_DATABASE_URL ?? appUrl;
const d = appUrl ? describe : describe.skip;

d('Parent Portal (integration)', () => {
  let app: INestApplication;
  let db: Client;
  let tenantId: string;

  const stamp = Date.now();
  const password = 'A-genuinely-long-password-1';
  const adminEmail = `pp-admin-${stamp}@school.ke`;
  const teacherEmail = `pp-teacher-${stamp}@school.ke`;
  const parentAEmail = `pp-parent-a-${stamp}@school.ke`;
  const parentBEmail = `pp-parent-b-${stamp}@school.ke`;

  let adminToken: string;
  let teacherToken: string;
  let parentAToken: string;
  let parentBToken: string;
  let classStreamId: string;
  let childId: string;

  const config: AppConfig = {
    nodeEnv: 'test',
    port: 0,
    databaseUrl: appUrl as string,
    workerDatabaseUrl: appUrl as string,
    outboxPollMs: 60_000,
    syncVisibilityDelaySeconds: 0,
    publicWebUrl: 'http://localhost:3000',
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
      `INSERT INTO core.tenants (slug, name, kind) VALUES ($1, 'Parent Portal School', 'school') RETURNING id`,
      [`pp-school-${stamp}`]
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
      [teacherEmail, 'teacher'],
      [parentAEmail, 'parent'],
      [parentBEmail, 'parent']
    ] as const) {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email, fullName: 'PP Person', password, tenantId, role })
        .expect(201);
    }
    adminToken = await login(adminEmail);
    teacherToken = await login(teacherEmail);
    parentAToken = await login(parentAEmail);
    parentBToken = await login(parentBEmail);

    const stream = await request(app.getHttpServer())
      .post('/v1/class-streams')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ name: 'Grade 3 Gold', gradeLevel: 'G3', academicYear: 2026 })
      .expect(201);
    classStreamId = stream.body.id;

    const child = await request(app.getHttpServer())
      .post('/v1/students')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'Achieng Odhiambo', gradeLevel: 'G3', classStreamId, academicYear: 2026 })
      .expect(201);
    childId = child.body.studentId;

    // Link parent A as the child's guardian; parent B has no link.
    const parentAId = (
      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('authorization', `Bearer ${parentAToken}`)
        .expect(200)
    ).body.id;
    const guardian = await request(app.getHttpServer())
      .post('/v1/guardians')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'Achieng Parent', phone: '+254700000000' })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/v1/guardians/${guardian.body.id}/link-account`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ userId: parentAId })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/v1/students/${childId}/guardians`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ guardianId: guardian.body.id, relationship: 'mother', isPrimary: true })
      .expect(201);

    await request(app.getHttpServer())
      .post('/v1/attendance')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ classStreamId, learnerId: childId, attendanceDate: '2026-07-29', status: 'present' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/students/${childId}/behaviour-notes`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ category: 'positive', note: 'Helped a classmate with reading.' })
      .expect(201);
  });

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it("lists the linked parent's children", async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/parent-portal/children')
      .set('authorization', `Bearer ${parentAToken}`)
      .expect(200);
    expect(res.body).toEqual([expect.objectContaining({ studentId: childId })]);
  });

  it('an unlinked parent sees no children and cannot read this child\u2019s records', async () => {
    const children = await request(app.getHttpServer())
      .get('/v1/parent-portal/children')
      .set('authorization', `Bearer ${parentBToken}`)
      .expect(200);
    expect(children.body).toEqual([]);

    await request(app.getHttpServer())
      .get(`/v1/parent-portal/children/${childId}/attendance`)
      .set('authorization', `Bearer ${parentBToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/v1/parent-portal/children/${childId}/behaviour-notes`)
      .set('authorization', `Bearer ${parentBToken}`)
      .expect(403);
  });

  it('the linked parent can read attendance and behaviour notes', async () => {
    const attendance = await request(app.getHttpServer())
      .get(`/v1/parent-portal/children/${childId}/attendance`)
      .set('authorization', `Bearer ${parentAToken}`)
      .expect(200);
    expect(attendance.body).toEqual([expect.objectContaining({ status: 'present' })]);

    const notes = await request(app.getHttpServer())
      .get(`/v1/parent-portal/children/${childId}/behaviour-notes`)
      .set('authorization', `Bearer ${parentAToken}`)
      .expect(200);
    expect(notes.body).toEqual([expect.objectContaining({ category: 'positive' })]);
  });

  it('performance view composes Learning submissions across enrolled courses', async () => {
    const course = await request(app.getHttpServer())
      .post('/v1/courses')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Grade 3 Reading', learningArea: 'English', gradeLevel: 'G3' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/courses/${course.body.id}/enrollments`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ userId: childId, courseRole: 'learner' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/courses/${course.body.id}/assignments`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Reading log', maxScore: 10 })
      .expect(201);

    const performance = await request(app.getHttpServer())
      .get(`/v1/parent-portal/children/${childId}/performance`)
      .set('authorization', `Bearer ${parentAToken}`)
      .expect(200);
    const entry = performance.body.find((c: { courseId: string }) => c.courseId === course.body.id);
    expect(entry).toBeDefined();
    expect(entry.assignments).toEqual([
      expect.objectContaining({ title: 'Reading log', submission: null })
    ]);
  });

  it('announcements: whole-school reaches everyone, grade-targeted reaches only that grade\u2019s guardians', async () => {
    await request(app.getHttpServer())
      .post('/v1/announcements')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ title: 'School closed Friday', body: 'Public holiday.' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/v1/announcements')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Grade 3 trip', body: 'Bring permission slips.', gradeLevel: 'G3' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/v1/announcements')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Grade 7 trip', body: 'Different grade entirely.', gradeLevel: 'G7' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/v1/parent-portal/announcements')
      .set('authorization', `Bearer ${parentAToken}`)
      .expect(200);
    const titles = res.body.map((a: { title: string }) => a.title);
    expect(titles).toContain('School closed Friday');
    expect(titles).toContain('Grade 3 trip');
    expect(titles).not.toContain('Grade 7 trip');
  });

  it('a non-staff account cannot post an announcement', async () => {
    await request(app.getHttpServer())
      .post('/v1/announcements')
      .set('authorization', `Bearer ${parentAToken}`)
      .send({ title: 'Not allowed', body: 'x' })
      .expect(403);
  });
});

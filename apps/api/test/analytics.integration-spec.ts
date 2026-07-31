import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { APP_CONFIG, type AppConfig } from '../src/config/configuration';

const appUrl = process.env.INTEGRATION_DATABASE_URL;
const adminUrl = process.env.INTEGRATION_ADMIN_DATABASE_URL ?? appUrl;
const d = appUrl ? describe : describe.skip;

d('Analytics (integration)', () => {
  let app: INestApplication;
  let db: Client;
  let tenantId: string;

  const stamp = Date.now();
  const password = 'A-genuinely-long-password-1';
  const year = 2026;

  let adminToken: string;
  let teacherToken: string;
  let teacher2Token: string;
  let teacherId: string;
  let courseId: string;
  let atRiskLearnerId: string;
  let healthyLearnerId: string;
  let classStreamId: string;

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
      `INSERT INTO core.tenants (slug, name, kind) VALUES ($1, 'Analytics Test School', 'school') RETURNING id`,
      [`an-school-${stamp}`]
    );
    tenantId = t.rows[0].id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(config)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1', { exclude: ['health'] });
    await app.init();

    const adminEmail = `an-admin-${stamp}@school.ke`;
    const teacherEmail = `an-teacher-${stamp}@school.ke`;
    const teacher2Email = `an-teacher2-${stamp}@school.ke`;
    for (const [email, role] of [
      [adminEmail, 'school_admin'],
      [teacherEmail, 'teacher'],
      [teacher2Email, 'teacher']
    ] as const) {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email, fullName: 'Analytics Person', password, tenantId, role })
        .expect(201);
    }
    adminToken = await login(adminEmail);
    teacherToken = await login(teacherEmail);
    teacher2Token = await login(teacher2Email);
    teacherId = (
      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('authorization', `Bearer ${teacherToken}`)
        .expect(200)
    ).body.id;

    const stream = await request(app.getHttpServer())
      .post('/v1/class-streams')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ name: 'Grade 7 Analytics', gradeLevel: 'G7', academicYear: year })
      .expect(201);
    classStreamId = stream.body.id;

    const course = await request(app.getHttpServer())
      .post('/v1/courses')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Grade 7 Kiswahili', learningArea: 'Kiswahili', gradeLevel: 'G7' })
      .expect(201);
    courseId = course.body.id;

    // Two learners: one healthy (good attendance, no submission yet),
    // one at-risk (poor attendance) — proves the attendance rule.
    const atRisk = await request(app.getHttpServer())
      .post('/v1/students')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'At Risk Learner', gradeLevel: 'G7', classStreamId, academicYear: year })
      .expect(201);
    atRiskLearnerId = atRisk.body.studentId;

    const healthy = await request(app.getHttpServer())
      .post('/v1/students')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'Healthy Learner', gradeLevel: 'G7', classStreamId, academicYear: year })
      .expect(201);
    healthyLearnerId = healthy.body.studentId;

    for (const learnerId of [atRiskLearnerId, healthyLearnerId]) {
      await request(app.getHttpServer())
        .post(`/v1/courses/${courseId}/enrollments`)
        .set('authorization', `Bearer ${teacherToken}`)
        .send({ userId: learnerId, courseRole: 'learner' })
        .expect(201);
    }

    // 6 days of attendance each (above the 5-day minimum): at-risk
    // learner present only 1/6 (~17%); healthy learner present 6/6.
    for (let day = 1; day <= 6; day += 1) {
      await request(app.getHttpServer())
        .post('/v1/attendance')
        .set('authorization', `Bearer ${teacherToken}`)
        .send({
          classStreamId,
          learnerId: atRiskLearnerId,
          attendanceDate: `${year}-02-0${day}`,
          status: day === 1 ? 'present' : 'absent'
        })
        .expect(201);
      await request(app.getHttpServer())
        .post('/v1/attendance')
        .set('authorization', `Bearer ${teacherToken}`)
        .send({
          classStreamId,
          learnerId: healthyLearnerId,
          attendanceDate: `${year}-02-0${day}`,
          status: 'present'
        })
        .expect(201);
    }

    // A separately-registered (real login) learner just to produce an
    // ungraded submission for the grading-backlog test — the SIS-
    // provisioned at-risk/healthy learners above are shadow accounts
    // (Sprint 5's UserProvisioningService) with intentionally unusable
    // random passwords and cannot log in to submit anything themselves.
    const submittingLearnerEmail = `an-submitter-${stamp}@school.ke`;
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: submittingLearnerEmail,
        fullName: 'Submitting Learner',
        password,
        tenantId,
        role: 'learner'
      })
      .expect(201);
    const submittingLearnerToken = await login(submittingLearnerEmail);
    const submittingLearnerId = (
      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('authorization', `Bearer ${submittingLearnerToken}`)
        .expect(200)
    ).body.id;

    const assignment = await request(app.getHttpServer())
      .post(`/v1/courses/${courseId}/assignments`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Insha', maxScore: 100 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/courses/${courseId}/enrollments`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ userId: submittingLearnerId, courseRole: 'learner' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/assignments/${assignment.body.id}/submissions`)
      .set('authorization', `Bearer ${submittingLearnerToken}`)
      .send({ content: {} })
      .expect(201);
  });

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it('a learner cannot access staff analytics endpoints', async () => {
    const learnerEmail = `an-learner-${stamp}@school.ke`;
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email: learnerEmail, fullName: 'Plain Learner', password, tenantId, role: 'learner' })
      .expect(201);
    const learnerToken = await login(learnerEmail);
    await request(app.getHttpServer())
      .get(`/v1/analytics/course/${courseId}`)
      .set('authorization', `Bearer ${learnerToken}`)
      .expect(403);
  });

  it('course analytics reflects enrollment and assignment counts', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/analytics/course/${courseId}`)
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(200);
    expect(res.body.enrolledLearners).toBe(3);
    expect(res.body.assignmentCount).toBe(1);
  });

  it("a teacher can view their own grading backlog but not another teacher's", async () => {
    const own = await request(app.getHttpServer())
      .get(`/v1/analytics/teacher/${teacherId}/grading-backlog`)
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(200);
    expect(own.body.pendingCount).toBeGreaterThanOrEqual(1);

    await request(app.getHttpServer())
      .get(`/v1/analytics/teacher/${teacherId}/grading-backlog`)
      .set('authorization', `Bearer ${teacher2Token}`)
      .expect(403);

    const asAdmin = await request(app.getHttpServer())
      .get(`/v1/analytics/teacher/${teacherId}/grading-backlog`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(asAdmin.body.teacherId).toBe(teacherId);
  });

  it('financial analytics is admin-only, not staff-general', async () => {
    await request(app.getHttpServer())
      .get('/v1/analytics/finance/collection-summary')
      .query({ academicYear: year })
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(403);

    const res = await request(app.getHttpServer())
      .get('/v1/analytics/finance/collection-summary')
      .query({ academicYear: year })
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.invoiceCount).toBe(0);
    expect(res.body.collectionRatePercent).toBeNull();
  });

  it('THE EARLY WARNING RULE ENGINE: flags the at-risk learner for low attendance and leaves the healthy learner unflagged', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/analytics/early-warning')
      .query({ academicYear: year })
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(200);

    const atRisk = res.body.learners.find((l: { learnerId: string }) => l.learnerId === atRiskLearnerId);
    expect(atRisk).toBeDefined();
    expect(atRisk.reasons).toContain('low_attendance');
    expect(atRisk.attendanceRate).toBeCloseTo(16.67, 1);

    const healthy = res.body.learners.find((l: { learnerId: string }) => l.learnerId === healthyLearnerId);
    expect(healthy).toBeUndefined();
  });

  it('the minimum-data safeguard withholds judgement for a learner with too few recorded days', async () => {
    const sparse = await request(app.getHttpServer())
      .post('/v1/students')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'Sparse Data Learner', gradeLevel: 'G7', classStreamId, academicYear: year })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/courses/${courseId}/enrollments`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ userId: sparse.body.studentId, courseRole: 'learner' })
      .expect(201);
    for (let day = 20; day <= 21; day += 1) {
      await request(app.getHttpServer())
        .post('/v1/attendance')
        .set('authorization', `Bearer ${teacherToken}`)
        .send({
          classStreamId,
          learnerId: sparse.body.studentId,
          attendanceDate: `${year}-02-${day}`,
          status: 'absent'
        })
        .expect(201);
    }

    const res = await request(app.getHttpServer())
      .get('/v1/analytics/early-warning')
      .query({ academicYear: year })
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(200);
    const sparseFlag = res.body.learners.find(
      (l: { learnerId: string }) => l.learnerId === sparse.body.studentId
    );
    expect(sparseFlag).toBeUndefined();
  });
});

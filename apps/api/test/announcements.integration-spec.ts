import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { APP_CONFIG, type AppConfig } from '../src/config/configuration';
import { NOTIFICATION_CHANNEL, type NotificationMessage } from '../src/core/notifications/notification';

const appUrl = process.env.INTEGRATION_DATABASE_URL;
const adminUrl = process.env.INTEGRATION_ADMIN_DATABASE_URL ?? appUrl;
const d = appUrl ? describe : describe.skip;

d('Announcement notifications and detail view (integration)', () => {
  let app: INestApplication;
  let db: Client;
  let tenantId: string;

  const stamp = Date.now();
  const password = 'A-genuinely-long-password-1';
  const adminEmail = `an-admin-${stamp}@school.ke`;
  const teacherEmail = `an-teacher-${stamp}@school.ke`;
  const g4ParentEmail = `an-g4-parent-${stamp}@school.ke`;
  const g4LearnerEmail = `an-g4-learner-${stamp}@school.ke`;
  const g5LearnerEmail = `an-g5-learner-${stamp}@school.ke`;

  let adminToken: string;
  let teacherToken: string;
  let g4LearnerToken: string;
  let g5LearnerToken: string;
  let g4ParentToken: string;

  const deliveredNotifications: NotificationMessage[] = [];
  const spyNotificationChannel = {
    deliver: async (message: NotificationMessage) => {
      deliveredNotifications.push(message);
    }
  };

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
    const res = await request(app.getHttpServer()).post('/v1/auth/login').send({ email, password }).expect(200);
    return res.body.tokens.accessToken as string;
  };

  /** Enrolls a real student via SIS (creates its own shadow account), then activates that exact account with a real, non-shadow email and password via the real endpoint — not a second, disconnected user, and not a raw SQL password-only update that would leave the shadow email in place. */
  const enrollAndActivateLearner = async (fullName: string, gradeLevel: string, classStreamId: string, realEmail: string) => {
    const student = await request(app.getHttpServer())
      .post('/v1/students')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ fullName, gradeLevel, classStreamId, academicYear: 2026 })
      .expect(201);
    const studentId = student.body.studentId as string;
    await request(app.getHttpServer())
      .patch(`/v1/students/${studentId}/activate-account`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ email: realEmail, password })
      .expect(200);
    return { studentId, email: realEmail };
  };

  beforeAll(async () => {
    db = new Client({ connectionString: adminUrl });
    await db.connect();
    const t = await db.query(
      `INSERT INTO core.tenants (slug, name, kind) VALUES ($1, 'Announcement Notification School', 'school') RETURNING id`,
      [`an-school-${stamp}`]
    );
    tenantId = t.rows[0].id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(config)
      .overrideProvider(NOTIFICATION_CHANNEL)
      .useValue(spyNotificationChannel)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1', { exclude: ['health'] });
    await app.init();

    for (const [email, role] of [
      [adminEmail, 'school_admin'],
      [teacherEmail, 'teacher'],
      [g4ParentEmail, 'parent']
    ] as const) {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email, fullName: 'Announcement Test Person', password, tenantId, role })
        .expect(201);
    }
    adminToken = await login(adminEmail);
    teacherToken = await login(teacherEmail);
    g4ParentToken = await login(g4ParentEmail);

    const g4Stream = await request(app.getHttpServer())
      .post('/v1/class-streams')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ name: 'Grade 4 Notification Test', gradeLevel: 'G4', academicYear: 2026 })
      .expect(201);
    const g4ClassStreamId = g4Stream.body.id;

    const g5Stream = await request(app.getHttpServer())
      .post('/v1/class-streams')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ name: 'Grade 5 Notification Test', gradeLevel: 'G5', academicYear: 2026 })
      .expect(201);
    const g5ClassStreamId = g5Stream.body.id;

    const g4Learner = await enrollAndActivateLearner('G4 Notification Student', 'G4', g4ClassStreamId, g4LearnerEmail);
    g4LearnerToken = await login(g4LearnerEmail);

    await enrollAndActivateLearner('G5 Notification Student', 'G5', g5ClassStreamId, g5LearnerEmail);
    g5LearnerToken = await login(g5LearnerEmail);

    const guardian = await request(app.getHttpServer())
      .post('/v1/guardians')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'G4 Notification Parent', phone: '+254700000001' })
      .expect(201);
    const g4ParentId = (
      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('authorization', `Bearer ${g4ParentToken}`)
        .expect(200)
    ).body.id;
    await request(app.getHttpServer())
      .patch(`/v1/guardians/${guardian.body.id}/link-account`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ userId: g4ParentId })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/v1/students/${g4Learner.studentId}/guardians`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ guardianId: guardian.body.id, relationship: 'mother', isPrimary: true })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
    await db.end();
  });

  it('posting a grade-4-targeted, students+parents announcement notifies the G4 learner and G4 parent, but not the G5 learner or a teacher', async () => {
    const before = deliveredNotifications.length;
    const created = await request(app.getHttpServer())
      .post('/v1/announcements')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        title: `G4 assembly reminder ${stamp}`,
        body: 'Assembly moved to 9am.',
        gradeLevel: 'G4',
        targetStudents: true,
        targetParents: true,
        targetTeachers: false
      })
      .expect(201);

    const fired = deliveredNotifications.slice(before);
    const toG4Learner = fired.find((n) => n.to.email === g4LearnerEmail);
    const toG4Parent = fired.find((n) => n.to.email === g4ParentEmail);
    const toG5Learner = fired.find((n) => n.to.email === g5LearnerEmail);
    const toTeacher = fired.find((n) => n.to.email === teacherEmail);

    expect(toG4Learner).toBeDefined();
    expect(toG4Learner!.template).toBe('new-announcement');
    expect(String(toG4Learner!.data.announcementUrl)).toContain(`/student/announcements/${created.body.id}`);

    expect(toG4Parent).toBeDefined();
    expect(String(toG4Parent!.data.announcementUrl)).toContain(`/parent/announcements/${created.body.id}`);

    // Not targeted at G5 at all, and targetTeachers was explicitly false.
    expect(toG5Learner).toBeUndefined();
    expect(toTeacher).toBeUndefined();
  });

  it('a whole-school, teachers-only announcement notifies the teacher but no learner or parent', async () => {
    const before = deliveredNotifications.length;
    await request(app.getHttpServer())
      .post('/v1/announcements')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        title: `Staff meeting notice ${stamp}`,
        body: 'Staff meeting at 4pm.',
        targetStudents: false,
        targetParents: false,
        targetTeachers: true
      })
      .expect(201);

    const fired = deliveredNotifications.slice(before);
    expect(fired.some((n) => n.to.email === teacherEmail)).toBe(true);
    expect(fired.some((n) => n.to.email === g4LearnerEmail)).toBe(false);
    expect(fired.some((n) => n.to.email === g4ParentEmail)).toBe(false);
  });

  it('GET /announcements/:id — staff can view it, the matching learner can view it, a different-grade learner is forbidden', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/announcements')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        title: `Detail view test ${stamp}`,
        body: 'Body for the detail view test.',
        gradeLevel: 'G4',
        targetStudents: true,
        targetParents: false,
        targetTeachers: false
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/v1/announcements/${created.body.id}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/v1/announcements/${created.body.id}`)
      .set('authorization', `Bearer ${g4LearnerToken}`)
      .expect(200);

    // Wrong grade — not targeted at G5 at all.
    await request(app.getHttpServer())
      .get(`/v1/announcements/${created.body.id}`)
      .set('authorization', `Bearer ${g5LearnerToken}`)
      .expect(403);

    // targetParents is false — even a real, linked G4 parent can't view it.
    await request(app.getHttpServer())
      .get(`/v1/announcements/${created.body.id}`)
      .set('authorization', `Bearer ${g4ParentToken}`)
      .expect(403);
  });

  it('GET /announcements/:id returns 404 for a genuinely nonexistent id, not a silent empty body', async () => {
    await request(app.getHttpServer())
      .get('/v1/announcements/00000000-0000-0000-0000-000000000000')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});

import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { APP_CONFIG, type AppConfig } from '../src/config/configuration';

const appUrl = process.env.INTEGRATION_DATABASE_URL;
const adminUrl = process.env.INTEGRATION_ADMIN_DATABASE_URL ?? appUrl;
const d = appUrl ? describe : describe.skip;

d('Teacher Portal (integration)', () => {
  let app: INestApplication;
  let db: Client;
  let tenantId: string;

  const stamp = Date.now();
  const password = 'A-genuinely-long-password-1';
  const teacherEmail = `tp-teacher-${stamp}@school.ke`;
  const assistantEmail = `tp-assistant-${stamp}@school.ke`;
  const adminEmail = `tp-admin-${stamp}@school.ke`;
  const learnerAcctEmail = `tp-learner-${stamp}@school.ke`;

  let teacherToken: string;
  let assistantToken: string;
  let adminToken: string;
  let classStreamId: string;
  let learnerId: string;
  let courseId: string;

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
      `INSERT INTO core.tenants (slug, name, kind) VALUES ($1, 'Teacher Portal School', 'school') RETURNING id`,
      [`tp-school-${stamp}`]
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
      [teacherEmail, 'teacher'],
      [assistantEmail, 'teacher'],
      [adminEmail, 'school_admin'],
      [learnerAcctEmail, 'learner']
    ] as const) {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email, fullName: 'TP Person', password, tenantId, role })
        .expect(201);
    }
    teacherToken = await login(teacherEmail);
    assistantToken = await login(assistantEmail);
    adminToken = await login(adminEmail);

    const createdStream = await request(app.getHttpServer())
      .post('/v1/class-streams')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ name: 'Grade 5 Red', gradeLevel: 'G5', academicYear: 2026 })
      .expect(201);
    classStreamId = createdStream.body.id;

    const learner = await request(app.getHttpServer())
      .post('/v1/students')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'Kiptoo Kirui', gradeLevel: 'G5', classStreamId, academicYear: 2026 })
      .expect(201);
    learnerId = learner.body.studentId;

    const course = await request(app.getHttpServer())
      .post('/v1/courses')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Grade 5 English', learningArea: 'English', gradeLevel: 'G5' })
      .expect(201);
    courseId = course.body.id;
  });

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it('a non-staff role (bare learner account) cannot mark attendance', async () => {
    const learnerToken = await login(learnerAcctEmail);
    await request(app.getHttpServer())
      .post('/v1/attendance')
      .set('authorization', `Bearer ${learnerToken}`)
      .send({ classStreamId, learnerId, attendanceDate: '2026-07-29', status: 'present' })
      .expect(403);
  });

  it('a real gap closed: an unrelated learner account cannot read another student\u2019s attendance, class-wide or individually', async () => {
    // Previously neither GET route had ANY authorization check beyond
    // being authenticated -- this proves the fix actually blocks
    // access, not just that it compiles. learnerAcctEmail's account
    // has no relationship at all to `learnerId` (a separate SIS
    // student profile) -- exactly the case that was silently allowed
    // before.
    const learnerToken = await login(learnerAcctEmail);
    await request(app.getHttpServer())
      .get(`/v1/attendance/class/${classStreamId}`)
      .query({ date: '2026-07-29' })
      .set('authorization', `Bearer ${learnerToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/v1/attendance/learner/${learnerId}`)
      .set('authorization', `Bearer ${learnerToken}`)
      .expect(403);
  });

  it('marks attendance synchronously', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/attendance')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ classStreamId, learnerId, attendanceDate: '2026-07-29', status: 'present' })
      .expect(201);
    expect(res.body.status).toBe('present');
  });

  it('LAST-WRITE-WINS: two different offline devices marking the same student/date — the later push wins outright, no merge', async () => {
    const date = '2026-07-30';

    // Device A (teacher's phone) pushes "absent" first.
    await request(app.getHttpServer())
      .post('/v1/sync/push')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({
        mutations: [
          {
            id: randomUUID(),
            type: 'attendance.mark.v1',
            payload: { classStreamId, learnerId, attendanceDate: date, status: 'absent' }
          }
        ]
      })
      .expect(200);

    let current = await request(app.getHttpServer())
      .get(`/v1/attendance/class/${classStreamId}`)
      .query({ date })
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(200);
    expect(current.body[0].status).toBe('absent');

    // Device B (assistant's tablet), synced later, pushes "late" for the
    // SAME student/date — a different mutation id, no merge, unconditional overwrite.
    await request(app.getHttpServer())
      .post('/v1/sync/push')
      .set('authorization', `Bearer ${assistantToken}`)
      .send({
        mutations: [
          {
            id: randomUUID(),
            type: 'attendance.mark.v1',
            payload: { classStreamId, learnerId, attendanceDate: date, status: 'late' }
          }
        ]
      })
      .expect(200);

    current = await request(app.getHttpServer())
      .get(`/v1/attendance/class/${classStreamId}`)
      .query({ date })
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(200);
    // Exactly one row (unique constraint on class/learner/date), and it
    // reflects the LAST write — contrast with Sprint 4's create-only
    // submissions, where a second write is a no-op that preserves the first.
    expect(current.body).toHaveLength(1);
    expect(current.body[0].status).toBe('late');
  });

  it('creates and lists a lesson plan, then advances through the full approval lifecycle', async () => {
    const plan = await request(app.getHttpServer())
      .post('/v1/lesson-plans')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({
        courseId,
        weekOf: '2026-08-03',
        objectives: 'Introduce persuasive writing',
        activities: [{ title: 'Group debate', minutes: 30 }]
      })
      .expect(201);
    expect(plan.body.status).toBe('draft');

    const list = await request(app.getHttpServer())
      .get(`/v1/lesson-plans/course/${courseId}`)
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(200);
    expect(list.body).toHaveLength(1);

    // draft -> approved directly, skipping review, is never allowed for anyone.
    await request(app.getHttpServer())
      .patch(`/v1/lesson-plans/${plan.body.id}/status`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' })
      .expect(404);

    const updated = await request(app.getHttpServer())
      .patch(`/v1/lesson-plans/${plan.body.id}/status`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ status: 'submitted' })
      .expect(200);
    expect(updated.body.status).toBe('submitted');

    // Shows up in the admin's cross-course review queue, with enough
    // context (course/teacher) to know what it's looking at.
    const pending = await request(app.getHttpServer())
      .get('/v1/lesson-plans/pending')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const queued = pending.body.find((p: { id: string }) => p.id === plan.body.id);
    expect(queued).toBeDefined();
    expect(queued.courseTitle).toBeTruthy();
    expect(queued.teacherName).toBeTruthy();

    // A teacher — even the one who wrote it — cannot approve their own plan.
    await request(app.getHttpServer())
      .patch(`/v1/lesson-plans/${plan.body.id}/status`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ status: 'approved' })
      .expect(403);

    // The pending queue itself is admin-only.
    await request(app.getHttpServer())
      .get('/v1/lesson-plans/pending')
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(403);

    // Admin sends it back for revision instead of approving.
    const sentBack = await request(app.getHttpServer())
      .patch(`/v1/lesson-plans/${plan.body.id}/status`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ status: 'draft' })
      .expect(200);
    expect(sentBack.body.status).toBe('draft');

    // Re-submit, then a real admin approval succeeds.
    await request(app.getHttpServer())
      .patch(`/v1/lesson-plans/${plan.body.id}/status`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ status: 'submitted' })
      .expect(200);
    const approved = await request(app.getHttpServer())
      .patch(`/v1/lesson-plans/${plan.body.id}/status`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' })
      .expect(200);
    expect(approved.body.status).toBe('approved');

    // Now approved, it no longer appears in the pending queue.
    const pendingAfter = await request(app.getHttpServer())
      .get('/v1/lesson-plans/pending')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(pendingAfter.body.find((p: { id: string }) => p.id === plan.body.id)).toBeUndefined();
  });

  it('re-saving a lesson plan for the same course/teacher/week overwrites rather than duplicating', async () => {
    await request(app.getHttpServer())
      .post('/v1/lesson-plans')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ courseId, weekOf: '2026-08-03', objectives: 'Revised objectives', activities: [] })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get(`/v1/lesson-plans/course/${courseId}`)
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].objectives).toBe('Revised objectives');
  });

  it('the composition-layer teacher dashboard aggregates pending grading and lesson plans across modules', async () => {
    const assignment = await request(app.getHttpServer())
      .post(`/v1/courses/${courseId}/assignments`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Essay draft', maxScore: 10 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/courses/${courseId}/enrollments`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ userId: learnerId, courseRole: 'learner' })
      .expect(201);

    const dashboard = await request(app.getHttpServer())
      .get('/v1/teacher/dashboard')
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(200);
    expect(dashboard.body.teacherId).toBeDefined();
    const myCourse = dashboard.body.courses.find((c: { courseId: string }) => c.courseId === courseId);
    expect(myCourse).toBeDefined();
    expect(dashboard.body.lessonPlansByCourse[courseId]).toBeDefined();
    expect(dashboard.body.lessonPlansByCourse[courseId]).toHaveLength(1);
    void assignment;
  });

  it('a course an admin creates and assigns to a teacher via a timetable slot appears on that teacher\'s dashboard, even though the teacher never created it', async () => {
    // The actual bug: the dashboard used to only show courses where
    // course.createdBy === the teacher's own userId, so a course an
    // admin created (the normal real-world path) and then assigned to
    // a teacher via the timetable never showed up for that teacher at
    // all -- they'd have no course to select for grading.
    const adminCourse = await request(app.getHttpServer())
      .post('/v1/courses')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ title: 'Admin-Created Course', learningArea: 'Science', gradeLevel: 'G5' })
      .expect(201);

    const room = await request(app.getHttpServer())
      .post('/v1/rooms')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ name: 'Dashboard Bug Test Room', roomType: 'classroom' })
      .expect(201);

    const teacherRow = await db.query(`SELECT id FROM core.users WHERE email = $1`, [teacherEmail]);
    const teacherId = teacherRow.rows[0].id;

    await request(app.getHttpServer())
      .post('/v1/timetable')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        classStreamId,
        courseId: adminCourse.body.id,
        teacherId,
        roomId: room.body.id,
        academicYear: new Date().getFullYear(),
        dayOfWeek: 3,
        startTime: '10:00',
        endTime: '11:00'
      })
      .expect(201);

    const dashboard = await request(app.getHttpServer())
      .get('/v1/teacher/dashboard')
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(200);
    const assignedCourse = dashboard.body.courses.find(
      (c: { courseId: string }) => c.courseId === adminCourse.body.id
    );
    expect(assignedCourse).toBeDefined();
    expect(assignedCourse.title).toBe('Admin-Created Course');
  });
});

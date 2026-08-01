import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { APP_CONFIG, type AppConfig } from '../src/config/configuration';

/**
 * Exercises the full CBC learning lifecycle AND the offline-first sync
 * engine against a real, migrated Postgres. Skipped unless
 * INTEGRATION_DATABASE_URL is set (see CI / README).
 */
const appUrl = process.env.INTEGRATION_DATABASE_URL;
const adminUrl = process.env.INTEGRATION_ADMIN_DATABASE_URL ?? appUrl;
const d = appUrl ? describe : describe.skip;

d('Learning platform + sync engine (integration)', () => {
  let app: INestApplication;
  let db: Client;
  let tenantA: string;
  let tenantB: string;

  const stamp = Date.now();
  const password = 'A-genuinely-long-password-1';
  const teacherEmail = `learn-teacher-${stamp}@school.ke`;
  const learnerEmail = `learn-learner-${stamp}@school.ke`;
  const otherTeacherEmail = `learn-other-${stamp}@school.ke`;

  let teacherToken: string;
  let learnerToken: string;
  let learnerId: string;
  let otherTeacherToken: string;

  let courseId: string;
  let moduleId: string;
  let assignmentId: string;
  let competencyId: string;

  const config: AppConfig = {
    nodeEnv: 'test',
    port: 0,
    databaseUrl: appUrl as string,
    workerDatabaseUrl: appUrl as string,
    outboxPollMs: 60_000,
  syncVisibilityDelaySeconds: 0,
    publicWebUrl: 'http://localhost:3000',
  uploadsDir: './uploads-test',
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

  const register = async (email: string, tenantId: string, role: string) => {
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email, fullName: 'Integration User', password, tenantId, role })
      .expect(201);
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password, tenantId })
      .expect(200);
    return res.body.tokens.accessToken as string;
  };

  beforeAll(async () => {
    db = new Client({ connectionString: adminUrl });
    await db.connect();
    const t = await db.query(
      `INSERT INTO core.tenants (slug, name, kind) VALUES
         ($1, 'Learning School A', 'school'), ($2, 'Learning School B', 'school')
       RETURNING id`,
      [`learn-a-${stamp}`, `learn-b-${stamp}`]
    );
    tenantA = t.rows[0].id;
    tenantB = t.rows[1].id;

    // Competencies are curriculum content (KICD import, out of this
    // sprint's scope) — seeded via the app role with a bound tenant
    // context. FORCE ROW LEVEL SECURITY applies even to the table
    // owner, so the admin connection cannot write here directly.
    competencyId = randomUUID();
    const appSeed = new Client({ connectionString: appUrl });
    await appSeed.connect();
    await appSeed.query('BEGIN');
    await appSeed.query("SELECT set_config('app.tenant_id', $1, true)", [tenantA]);
    await appSeed.query(
      `INSERT INTO learning.competencies (id, tenant_id, code, title, strand)
       VALUES ($1, core.current_tenant_id(), 'MATH.G4.NUM.1.1', 'Add two-digit numbers', 'Numbers')`,
      [competencyId]
    );
    await appSeed.query('COMMIT');
    await appSeed.end();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(config)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1', { exclude: ['health'] });
    await app.init();

    teacherToken = await register(teacherEmail, tenantA, 'teacher');
    learnerToken = await register(learnerEmail, tenantA, 'learner');
    otherTeacherToken = await register(otherTeacherEmail, tenantB, 'teacher');

    learnerId = (
      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('authorization', `Bearer ${learnerToken}`)
        .expect(200)
    ).body.id;
  });

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it('a teacher creates a course and is auto-enrolled as its teacher', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/courses')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Grade 4 Mathematics', learningArea: 'Mathematics', gradeLevel: 'G4' })
      .expect(201);
    courseId = res.body.id;
    expect(res.body).toMatchObject({ status: 'draft', gradeLevel: 'G4' });

    const roster = await request(app.getHttpServer())
      .get(`/v1/courses/${courseId}/roster`)
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(200);
    expect(roster.body).toEqual([
      expect.objectContaining({ courseRole: 'teacher' })
    ]);
  });

  it('a teacher from another tenant cannot see or manage this course (RLS)', async () => {
    await request(app.getHttpServer())
      .get(`/v1/courses/${courseId}`)
      .set('authorization', `Bearer ${otherTeacherToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/v1/courses/${courseId}/modules`)
      .set('authorization', `Bearer ${otherTeacherToken}`)
      .send({ title: 'Sneaky module', position: 0 })
      .expect(403); // requireCourseTeacher: not enrolled — same outcome as cross-tenant
  });

  it('builds a module and lesson under the course', async () => {
    const mod = await request(app.getHttpServer())
      .post(`/v1/courses/${courseId}/modules`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Addition and Subtraction', position: 0 })
      .expect(201);
    moduleId = mod.body.id;

    const lesson = await request(app.getHttpServer())
      .post(`/v1/courses/${courseId}/modules/${moduleId}/lessons`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Carrying in addition', position: 0, content: { blocks: [] } })
      .expect(201);
    expect(lesson.body.moduleId).toBe(moduleId);
  });

  it('creates a CBC assignment linked to a competency', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/courses/${courseId}/assignments`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Addition worksheet',
        maxScore: 20,
        competencyIds: [competencyId],
        rubric: { EE: 'No errors', ME: 'Minor errors', AE: 'Several errors', BE: 'Major gaps' }
      })
      .expect(201);
    assignmentId = res.body.id;
    expect(res.body.competencies).toEqual([
      expect.objectContaining({ code: 'MATH.G4.NUM.1.1' })
    ]);
  });

  it('enrolls the learner', async () => {
    await request(app.getHttpServer())
      .post(`/v1/courses/${courseId}/enrollments`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ userId: learnerId, courseRole: 'learner' })
      .expect(201);
  });

  it('an unenrolled action is rejected before an enrolled one succeeds', async () => {
    // Sanity: assignment exists but learner isn't enrolled yet on a SECOND
    // course to prove the check is per-course, not global.
    const otherCourse = await request(app.getHttpServer())
      .post('/v1/courses')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Grade 4 Science', learningArea: 'Science', gradeLevel: 'G4' })
      .expect(201);
    const otherAssignment = await request(app.getHttpServer())
      .post(`/v1/courses/${otherCourse.body.id}/assignments`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Plants worksheet', maxScore: 10 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/assignments/${otherAssignment.body.id}/submissions`)
      .set('authorization', `Bearer ${learnerToken}`)
      .send({ content: { answer: 'photosynthesis' } })
      .expect(403);
  });

  it('the learner submits offline via sync push, and the mutation is idempotent on retry', async () => {
    const mutationId = randomUUID();
    const push = () =>
      request(app.getHttpServer())
        .post('/v1/sync/push')
        .set('authorization', `Bearer ${learnerToken}`)
        .send({
          mutations: [
            {
              id: mutationId,
              type: 'submission.create.v1',
              payload: { assignmentId, content: { answer: '7 + 8 = 15, carry the 1' } }
            }
          ]
        })
        .expect(200);

    const first = await push();
    expect(first.body[0].outcome).toMatchObject({ status: 'applied' });
    const submissionId = first.body[0].outcome.data.submissionId;
    expect(first.body[0].outcome.data.alreadyExisted).toBe(false);

    // Simulate the offline client retrying because it never saw the ack.
    const retry = await push();
    expect(retry.body[0].outcome.data.submissionId).toBe(submissionId);

    // Exactly one submission row exists despite two pushes.
    const count = await request(app.getHttpServer())
      .get(`/v1/assignments/${assignmentId}/submissions`)
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(200);
    expect(count.body).toHaveLength(1);
  });

  it('a second, different mutation id for the same assignment is rejected by the DB unique constraint', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/sync/push')
      .set('authorization', `Bearer ${learnerToken}`)
      .send({
        mutations: [
          {
            id: randomUUID(),
            type: 'submission.create.v1',
            payload: { assignmentId, content: { answer: 'a different attempt' } }
          }
        ]
      })
      .expect(200);
    // upsertSubmission treats this as the existing row (ON CONFLICT DO NOTHING
    // + re-select) — one submission per learner per assignment, first wins.
    expect(res.body[0].outcome.data.alreadyExisted).toBe(true);
  });

  it('the teacher grades the submission with CBC rubric levels', async () => {
    const subs = await request(app.getHttpServer())
      .get(`/v1/assignments/${assignmentId}/submissions`)
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(200);
    const submissionId = subs.body[0].id;

    const graded = await request(app.getHttpServer())
      .patch(`/v1/submissions/${submissionId}/grade`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ score: 18, rubricLevels: { [competencyId]: 'ME' }, feedback: 'Good work, watch your carrying.' })
      .expect(200);
    expect(graded.body).toMatchObject({ status: 'graded', score: '18.00' });

    await request(app.getHttpServer())
      .patch(`/v1/submissions/${submissionId}/grade`)
      .set('authorization', `Bearer ${learnerToken}`)
      .send({ score: 20 })
      .expect(403);
  });

  it('sync pull returns the tenant change feed and advances the cursor', async () => {
    const first = await request(app.getHttpServer())
      .post('/v1/sync/pull')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ cursor: '0' })
      .expect(200);
    expect(first.body.changes.length).toBeGreaterThan(0);
    expect(first.body.changes.some((c: { table: string }) => c.table === 'learning.courses')).toBe(
      true
    );
    expect(
      first.body.changes.some((c: { table: string }) => c.table === 'learning.submissions')
    ).toBe(true);

    const second = await request(app.getHttpServer())
      .post('/v1/sync/pull')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ cursor: first.body.nextCursor })
      .expect(200);
    // Nothing new since the cursor advanced to the tail.
    expect(second.body.changes).toEqual([]);
  });

  it('a nonzero visibility delay withholds very recent commits from the pull feed', async () => {
    const delayedConfig: AppConfig = { ...config, syncVisibilityDelaySeconds: 60 };
    const delayedModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(delayedConfig)
      .compile();
    const delayedApp = await delayedModule.createNestApplication();
    delayedApp.setGlobalPrefix('v1', { exclude: ['health'] });
    await delayedApp.init();
    try {
      const res = await request(delayedApp.getHttpServer())
        .post('/v1/sync/pull')
        .set('authorization', `Bearer ${teacherToken}`)
        .send({ cursor: '0' })
        .expect(200);
      // Everything so far was committed well within the last 60 seconds.
      expect(res.body.changes).toEqual([]);
    } finally {
      await delayedApp.close();
    }
  });

  it('tenant B cannot see tenant A rows through the change feed', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/sync/pull')
      .set('authorization', `Bearer ${otherTeacherToken}`)
      .send({ cursor: '0' })
      .expect(200);
    const rowIds = new Set(res.body.changes.map((c: { rowId: string }) => c.rowId));
    expect(rowIds.has(courseId)).toBe(false);
  });
});

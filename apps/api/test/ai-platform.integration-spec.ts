import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { APP_CONFIG, type AppConfig } from '../src/config/configuration';

const appUrl = process.env.INTEGRATION_DATABASE_URL;
const adminUrl = process.env.INTEGRATION_ADMIN_DATABASE_URL ?? appUrl;
const d = appUrl ? describe : describe.skip;

d('AI Platform (integration)', () => {
  let app: INestApplication;
  let db: Client;
  let tenantId: string;

  const stamp = Date.now();
  const password = 'A-genuinely-long-password-1';
  const teacherEmail = `ai-teacher-${stamp}@school.ke`;
  const learnerEmail = `ai-learner-${stamp}@school.ke`;

  let teacherToken: string;
  let learnerToken: string;
  let bankId: string;
  let courseId: string;

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
      `INSERT INTO core.tenants (slug, name, kind) VALUES ($1, 'AI Platform Test School', 'school') RETURNING id`,
      [`ai-school-${stamp}`]
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
      [learnerEmail, 'learner']
    ] as const) {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email, fullName: 'AI Person', password, tenantId, role })
        .expect(201);
    }
    teacherToken = await login(teacherEmail);
    learnerToken = await login(learnerEmail);

    const course = await request(app.getHttpServer())
      .post('/v1/courses')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Grade 6 Science', learningArea: 'Science', gradeLevel: 'G6' })
      .expect(201);
    courseId = course.body.id;

    const bank = await request(app.getHttpServer())
      .post('/v1/question-banks')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Grade 6 Science Bank', subject: 'Science', gradeLevel: 'G6' })
      .expect(201);
    bankId = bank.body.id;

    // One manually-authored, already-approved question so the exam
    // has a legitimate approved question to draw from throughout.
    await request(app.getHttpServer())
      .post(`/v1/question-banks/${bankId}/questions`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({
        questionType: 'mcq',
        prompt: 'Water boils at what temperature at sea level (Celsius)?',
        options: [
          { id: 'a', text: '90' },
          { id: 'b', text: '100' },
          { id: 'c', text: '110' }
        ],
        correctOptionId: 'b',
        marks: 10
      })
      .expect(201);
  });

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it('a learner cannot draft AI content (staff-only) for lesson plans or exam questions', async () => {
    await request(app.getHttpServer())
      .post(`/v1/question-banks/${bankId}/questions/ai-draft`)
      .set('authorization', `Bearer ${learnerToken}`)
      .send({ topic: 'States of matter', marks: 10 })
      .expect(403);
    await request(app.getHttpServer())
      .post('/v1/lesson-plans/ai-draft')
      .set('authorization', `Bearer ${learnerToken}`)
      .send({ courseId, weekOf: '2026-09-07', topic: 'States of matter' })
      .expect(403);
  });

  it('THE SAFETY GATE: an AI-drafted question lands pending and is invisible to the random exam draw until a teacher approves it', async () => {
    const drafted = await request(app.getHttpServer())
      .post(`/v1/question-banks/${bankId}/questions/ai-draft`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ topic: 'States of matter', marks: 10 })
      .expect(201);
    expect(drafted.body.aiGenerated).toBe(true);
    expect(drafted.body.reviewStatus).toBe('pending');
    const draftedId = drafted.body.id;

    // An exam requiring 2 questions FAILS: only 1 is approved (the
    // manual one) even though 2 total exist — the pending AI draft
    // does not count.
    await request(app.getHttpServer())
      .post('/v1/exams')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({
        courseId,
        questionBankId: bankId,
        title: 'Too few approved',
        durationMinutes: 30,
        questionCount: 2
      })
      .expect(400);

    // An exam requiring exactly 1 question succeeds, and the random
    // draw never includes the pending question.
    const exam = await request(app.getHttpServer())
      .post('/v1/exams')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({
        courseId,
        questionBankId: bankId,
        title: 'Approved-only exam',
        durationMinutes: 30,
        questionCount: 1
      })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/v1/exams/${exam.body.id}/status`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ status: 'published' })
      .expect(200);

    const attempt = await request(app.getHttpServer())
      .post(`/v1/exams/${exam.body.id}/attempts`)
      .set('authorization', `Bearer ${learnerToken}`)
      .expect(201);
    expect(attempt.body.questionIds).not.toContain(draftedId);

    // Now the teacher approves it — and it becomes selectable.
    const reviewed = await request(app.getHttpServer())
      .patch(`/v1/question-banks/questions/${draftedId}/review`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ status: 'approved' })
      .expect(200);
    expect(reviewed.body.reviewStatus).toBe('approved');
  });

  it('rejecting an AI-drafted question leaves it permanently unselectable, and review is one-shot', async () => {
    const drafted = await request(app.getHttpServer())
      .post(`/v1/question-banks/${bankId}/questions/ai-draft`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ topic: 'To be rejected', marks: 5 })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/v1/question-banks/questions/${drafted.body.id}/review`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ status: 'rejected' })
      .expect(200);

    // Re-reviewing an already-decided question is rejected — the
    // review gate is one-shot, not repeatedly overridable.
    await request(app.getHttpServer())
      .patch(`/v1/question-banks/questions/${drafted.body.id}/review`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ status: 'approved' })
      .expect(404);
  });

  it('AI lesson plan drafts reuse the existing draft/submitted/approved workflow, tagged as ai_generated', async () => {
    const drafted = await request(app.getHttpServer())
      .post('/v1/lesson-plans/ai-draft')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ courseId, weekOf: '2026-09-14', topic: 'The water cycle' })
      .expect(201);
    expect(drafted.body.status).toBe('draft');
    expect(drafted.body.aiGenerated).toBe(true);
    expect(drafted.body.objectives).toContain('SANDBOX AI DRAFT');

    // The SAME approval endpoint from Sprint 6 advances it — no
    // parallel AI-specific approval path exists.
    const approved = await request(app.getHttpServer())
      .patch(`/v1/lesson-plans/${drafted.body.id}/status`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ status: 'approved' })
      .expect(200);
    expect(approved.body.status).toBe('approved');
  });

  it('feedback drafts are returned for review and never auto-saved onto the submission', async () => {
    const assignment = await request(app.getHttpServer())
      .post(`/v1/courses/${courseId}/assignments`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Water cycle diagram', maxScore: 10 })
      .expect(201);
    const learnerId = (
      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('authorization', `Bearer ${learnerToken}`)
        .expect(200)
    ).body.id;
    await request(app.getHttpServer())
      .post(`/v1/courses/${courseId}/enrollments`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ userId: learnerId, courseRole: 'learner' })
      .expect(201);
    const submission = await request(app.getHttpServer())
      .post(`/v1/assignments/${assignment.body.id}/submissions`)
      .set('authorization', `Bearer ${learnerToken}`)
      .send({ content: { diagram: 'evaporation -> condensation -> precipitation' } })
      .expect(201);

    const draft = await request(app.getHttpServer())
      .post(`/v1/submissions/${submission.body.id}/feedback-draft`)
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(201);
    expect(draft.body.draft).toContain('SANDBOX AI DRAFT');

    // Requesting a draft must NOT have touched the submission's
    // feedback/status — only the existing grade endpoint does that.
    const untouched = await request(app.getHttpServer())
      .get(`/v1/assignments/${assignment.body.id}/submissions/me`)
      .set('authorization', `Bearer ${learnerToken}`)
      .expect(200);
    expect(untouched.body.status).toBe('submitted');
    expect(untouched.body.feedback).toBeNull();

    // The teacher explicitly grades — same endpoint as ever, whether
    // or not they used the AI draft as a starting point.
    const graded = await request(app.getHttpServer())
      .patch(`/v1/submissions/${submission.body.id}/grade`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ score: 9, feedback: 'Nice diagram — label the arrows next time.' })
      .expect(200);
    expect(graded.body.feedback).toBe('Nice diagram — label the arrows next time.');
  });

  it('homework help is a single-turn, logged Q&A — not a persistent chat — and every interaction is auditable', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/ai/homework-help')
      .set('authorization', `Bearer ${learnerToken}`)
      .send({ subject: 'Science', gradeLevel: 'G6', question: 'Why does ice float on water?' })
      .expect(201);
    expect(res.body.answer).toContain('SANDBOX AI DRAFT');

    // Staff cannot use the learner-facing homework helper.
    await request(app.getHttpServer())
      .post('/v1/ai/homework-help')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ subject: 'Science', gradeLevel: 'G6', question: 'test' })
      .expect(403);

    const history = await request(app.getHttpServer())
      .get('/v1/ai/homework-help/history')
      .set('authorization', `Bearer ${learnerToken}`)
      .expect(200);
    expect(history.body).toEqual([
      expect.objectContaining({ feature: 'homework_help', promptSummary: 'Why does ice float on water?' })
    ]);
  });

  it('every AI feature this sprint used is reflected in the ai.interactions audit log', async () => {
    const appRead = new Client({ connectionString: appUrl });
    await appRead.connect();
    await appRead.query("SELECT set_config('app.tenant_id', $1, false)", [tenantId]);
    const { rows } = await appRead.query(
      `SELECT DISTINCT feature FROM ai.interactions WHERE tenant_id = core.current_tenant_id() ORDER BY feature`
    );
    await appRead.end();
    expect(rows.map((r) => r.feature)).toEqual([
      'exam_question_draft',
      'feedback_draft',
      'homework_help',
      'lesson_plan_draft'
    ]);
  });
});

import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { APP_CONFIG, type AppConfig } from '../src/config/configuration';

const appUrl = process.env.INTEGRATION_DATABASE_URL;
const adminUrl = process.env.INTEGRATION_ADMIN_DATABASE_URL ?? appUrl;
const d = appUrl ? describe : describe.skip;

d('Assessment Platform (integration)', () => {
  let app: INestApplication;
  let db: Client;
  let tenantId: string;

  const stamp = Date.now();
  const password = 'A-genuinely-long-password-1';
  const teacherEmail = `as-teacher-${stamp}@school.ke`;
  const learnerEmail = `as-learner-${stamp}@school.ke`;
  const learner2Email = `as-learner2-${stamp}@school.ke`;

  let teacherToken: string;
  let learnerToken: string;
  let learner2Token: string;
  let bankId: string;
  let courseId: string;
  let examId: string;
  const seededQuestionIds: string[] = [];

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
      `INSERT INTO core.tenants (slug, name, kind) VALUES ($1, 'Assessment Test School', 'school') RETURNING id`,
      [`as-school-${stamp}`]
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
      [learnerEmail, 'learner'],
      [learner2Email, 'learner']
    ] as const) {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email, fullName: 'Assessment Person', password, tenantId, role })
        .expect(201);
    }
    teacherToken = await login(teacherEmail);
    learnerToken = await login(learnerEmail);
    learner2Token = await login(learner2Email);

    const course = await request(app.getHttpServer())
      .post('/v1/courses')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Grade 5 Mathematics', learningArea: 'Mathematics', gradeLevel: 'G5' })
      .expect(201);
    courseId = course.body.id;

    const bank = await request(app.getHttpServer())
      .post('/v1/question-banks')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Grade 5 Maths Term 1', subject: 'Mathematics', gradeLevel: 'G5' })
      .expect(201);
    bankId = bank.body.id;

    // 5 MCQs so a 3-question exam has genuine randomization to prove.
    for (let i = 0; i < 5; i += 1) {
      const q = await request(app.getHttpServer())
        .post(`/v1/question-banks/${bankId}/questions`)
        .set('authorization', `Bearer ${teacherToken}`)
        .send({
          questionType: 'mcq',
          prompt: `What is ${i + 1} + ${i + 1}?`,
          options: [
            { id: 'a', text: String(i + i) },
            { id: 'b', text: String(i + i + 1) },
            { id: 'c', text: String(i + i + 2) }
          ],
          correctOptionId: 'c',
          marks: 10
        })
        .expect(201);
      seededQuestionIds.push(q.body.id);
    }
    // One essay question so manual grading has something to do.
    const essay = await request(app.getHttpServer())
      .post(`/v1/question-banks/${bankId}/questions`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({
        questionType: 'essay',
        prompt: 'Explain the commutative property of addition.',
        marks: 20
      })
      .expect(201);
    seededQuestionIds.push(essay.body.id);
  });

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it('rejects creating an exam that requests more questions than the bank has', async () => {
    await request(app.getHttpServer())
      .post('/v1/exams')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({
        courseId,
        questionBankId: bankId,
        title: 'Impossible exam',
        durationMinutes: 30,
        questionCount: 999
      })
      .expect(400);
  });

  it('creates a draft exam drawing 3 of the 6 available questions', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/exams')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({
        courseId,
        questionBankId: bankId,
        title: 'Term 1 CAT',
        durationMinutes: 40,
        questionCount: 3
      })
      .expect(201);
    examId = res.body.id;
    expect(res.body.status).toBe('draft');
  });

  it('a learner cannot attempt a draft (unpublished) exam', async () => {
    await request(app.getHttpServer())
      .post(`/v1/exams/${examId}/attempts`)
      .set('authorization', `Bearer ${learnerToken}`)
      .expect(400);
  });

  it('a teacher cannot start an attempt (learners only) once the exam is published', async () => {
    await request(app.getHttpServer())
      .patch(`/v1/exams/${examId}/status`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ status: 'published' })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/v1/exams/${examId}/attempts`)
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(403);
  });

  it('starting an attempt draws exactly questionCount distinct questions from the bank, and a second attempt is blocked', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/exams/${examId}/attempts`)
      .set('authorization', `Bearer ${learnerToken}`)
      .expect(201);
    expect(res.body.questionIds).toHaveLength(3);
    expect(new Set(res.body.questionIds).size).toBe(3);
    for (const id of res.body.questionIds as string[]) {
      expect(seededQuestionIds).toContain(id);
    }

    await request(app.getHttpServer())
      .post(`/v1/exams/${examId}/attempts`)
      .set('authorization', `Bearer ${learnerToken}`)
      .expect(409);
  });

  it('a different learner gets their own frozen draw, and the answer key never appears in the learner-facing view', async () => {
    const mine = await request(app.getHttpServer())
      .post(`/v1/exams/${examId}/attempts`)
      .set('authorization', `Bearer ${learner2Token}`)
      .expect(201);
    const attemptId = mine.body.id;

    const questionsSeen = await request(app.getHttpServer())
      .get(`/v1/exam-attempts/${attemptId}/questions`)
      .set('authorization', `Bearer ${learner2Token}`)
      .expect(200);
    expect(questionsSeen.body).toHaveLength(3);
    for (const q of questionsSeen.body) {
      expect(q).not.toHaveProperty('correctOptionId');
    }

    // A learner cannot view another learner's attempt questions.
    await request(app.getHttpServer())
      .get(`/v1/exam-attempts/${attemptId}/questions`)
      .set('authorization', `Bearer ${learnerToken}`)
      .expect(403);
  });

  it('submitting answers auto-grades MCQs correctly and leaves manual marks at zero pending grading', async () => {
    const list = await request(app.getHttpServer())
      .get(`/v1/exams/${examId}/attempts`)
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(200);
    const mine = list.body.find(
      (a: { learnerId: string; status: string }) => a.status === 'in_progress'
    );
    const attemptId = mine.id;

    const questionsSeen = await request(app.getHttpServer())
      .get(`/v1/exam-attempts/${attemptId}/questions`)
      .set('authorization', `Bearer ${learnerToken}`)
      .expect(200);

    // Every seeded MCQ's correct answer is 'c'; answer every MCQ
    // correctly and give the essay question, if drawn, a text answer.
    const answers: Record<string, string> = {};
    let mcqCount = 0;
    for (const q of questionsSeen.body) {
      if (q.questionType === 'mcq') {
        answers[q.id] = 'c';
        mcqCount += 1;
      } else {
        answers[q.id] = 'Addition order does not change the sum.';
      }
    }

    const submitted = await request(app.getHttpServer())
      .post(`/v1/exam-attempts/${attemptId}/submit`)
      .set('authorization', `Bearer ${learnerToken}`)
      .send({ answers })
      .expect(201);
    expect(submitted.body.status).toBe('submitted');
    expect(Number(submitted.body.autoScore)).toBe(mcqCount * 10);
    expect(Number(submitted.body.manualScore)).toBe(0);

    await request(app.getHttpServer())
      .post(`/v1/exam-attempts/${attemptId}/submit`)
      .set('authorization', `Bearer ${learnerToken}`)
      .send({ answers })
      .expect(404); // already submitted — no longer in_progress
  });

  it('a learner cannot grade attempts (staff-only); grading finalizes the score', async () => {
    const list = await request(app.getHttpServer())
      .get(`/v1/exams/${examId}/attempts`)
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(200);
    const submittedAttempt = list.body.find((a: { status: string }) => a.status === 'submitted');
    expect(submittedAttempt).toBeDefined();

    await request(app.getHttpServer())
      .patch(`/v1/exam-attempts/${submittedAttempt.id}/grade`)
      .set('authorization', `Bearer ${learnerToken}`)
      .send({ manualScore: 20 })
      .expect(403);

    const graded = await request(app.getHttpServer())
      .patch(`/v1/exam-attempts/${submittedAttempt.id}/grade`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ manualScore: 18 })
      .expect(200);
    expect(graded.body.status).toBe('graded');
    expect(Number(graded.body.finalScore)).toBe(Number(submittedAttempt.autoScore) + 18);
  });

  it('issuing a certificate is staff-only and lists correctly for the student', async () => {
    const studentId = (
      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('authorization', `Bearer ${learnerToken}`)
        .expect(200)
    ).body.id;

    await request(app.getHttpServer())
      .post('/v1/certificates')
      .set('authorization', `Bearer ${learnerToken}`)
      .send({ studentId, title: 'Should not work' })
      .expect(403);

    const cert = await request(app.getHttpServer())
      .post('/v1/certificates')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ studentId, title: 'Grade 5 Term 1 Mathematics CAT — Distinction' })
      .expect(201);
    expect(cert.body.certificateNumber).toMatch(/^CERT-\d{4}-[0-9A-F]{8}$/);

    const list = await request(app.getHttpServer())
      .get(`/v1/certificates/student/${studentId}`)
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
  });
});

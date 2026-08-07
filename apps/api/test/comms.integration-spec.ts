import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { APP_CONFIG, type AppConfig } from '../src/config/configuration';

const appUrl = process.env.INTEGRATION_DATABASE_URL;
const adminUrl = process.env.INTEGRATION_ADMIN_DATABASE_URL ?? appUrl;
const d = appUrl ? describe : describe.skip;

d('Direct messaging (integration)', () => {
  let app: INestApplication;
  let db: Client;
  let tenantId: string;

  const stamp = Date.now();
  const password = 'A-genuinely-long-password-1';
  const teacherEmail = `msg-teacher-${stamp}@school.ke`;
  const secondTeacherEmail = `msg-teacher2-${stamp}@school.ke`;
  const learnerEmail = `msg-learner-${stamp}@school.ke`;
  const secondLearnerEmail = `msg-learner2-${stamp}@school.ke`;

  let teacherToken: string;
  let secondTeacherToken: string;
  let learnerToken: string;
  let secondLearnerToken: string;
  let learnerId: string;

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

  beforeAll(async () => {
    db = new Client({ connectionString: adminUrl });
    await db.connect();
    const t = await db.query(
      `INSERT INTO core.tenants (slug, name, kind) VALUES ($1, 'Messaging Test School', 'school') RETURNING id`,
      [`msg-school-${stamp}`]
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
      [secondTeacherEmail, 'teacher'],
      [learnerEmail, 'learner'],
      [secondLearnerEmail, 'learner']
    ] as const) {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email, fullName: 'Messaging Person', password, tenantId, role })
        .expect(201);
    }
    teacherToken = await login(teacherEmail);
    secondTeacherToken = await login(secondTeacherEmail);
    learnerToken = await login(learnerEmail);
    secondLearnerToken = await login(secondLearnerEmail);

    const learnerRow = await db.query(`SELECT id FROM core.users WHERE email = $1`, [learnerEmail]);
    learnerId = learnerRow.rows[0].id;
  });

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it('a learner cannot start a conversation — only staff can initiate', async () => {
    await request(app.getHttpServer())
      .post('/v1/conversations')
      .set('authorization', `Bearer ${learnerToken}`)
      .send({ studentId: learnerId, body: 'hi' })
      .expect(403);
  });

  let conversationId: string;

  it('a teacher starts a conversation with a student, and the student can see and reply to it', async () => {
    const start = await request(app.getHttpServer())
      .post('/v1/conversations')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ studentId: learnerId, body: 'Please see me after class about your assignment.' })
      .expect(201);
    conversationId = start.body.conversation.id;
    expect(start.body.message.body).toBe('Please see me after class about your assignment.');

    const studentList = await request(app.getHttpServer())
      .get('/v1/conversations')
      .set('authorization', `Bearer ${learnerToken}`)
      .expect(200);
    const found = studentList.body.find((c: { id: string }) => c.id === conversationId);
    expect(found).toBeDefined();
    expect(found.otherPartyName).toBe('Messaging Person');
    expect(found.unreadCount).toBe(1);

    const reply = await request(app.getHttpServer())
      .post(`/v1/conversations/${conversationId}/messages`)
      .set('authorization', `Bearer ${learnerToken}`)
      .send({ body: 'Okay, I will be there.' })
      .expect(201);
    expect(reply.body.senderId).toBe(learnerId);

    const messages = await request(app.getHttpServer())
      .get(`/v1/conversations/${conversationId}/messages`)
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(200);
    expect(messages.body).toHaveLength(2);
    expect(messages.body[0].body).toBe('Please see me after class about your assignment.');
    expect(messages.body[1].body).toBe('Okay, I will be there.');
  });

  it('sending to the same student again continues the existing conversation rather than creating a duplicate', async () => {
    const secondStart = await request(app.getHttpServer())
      .post('/v1/conversations')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ studentId: learnerId, body: 'Following up on that.' })
      .expect(201);
    expect(secondStart.body.conversation.id).toBe(conversationId);

    const messages = await request(app.getHttpServer())
      .get(`/v1/conversations/${conversationId}/messages`)
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(200);
    expect(messages.body).toHaveLength(3);
  });

  it('viewing a conversation marks the other participant\'s messages as read', async () => {
    // By this point the teacher has already viewed the conversation
    // once (at the end of the first test, to verify both messages
    // were visible) -- that view already marked the student's one
    // reply as read. The "Following up on that." message from the
    // second test is unread by the student, not the teacher, so it
    // doesn't affect the teacher's own unread count.
    const beforeStudentViews = await request(app.getHttpServer())
      .get('/v1/conversations')
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(200);
    expect(beforeStudentViews.body.find((c: { id: string }) => c.id === conversationId).unreadCount).toBe(0);

    // The student, however, has one unread message from the teacher
    // ("Following up on that.") until they view it.
    const studentBeforeView = await request(app.getHttpServer())
      .get('/v1/conversations')
      .set('authorization', `Bearer ${learnerToken}`)
      .expect(200);
    // The student has two unread messages from the teacher at this
    // point ("Please see me..." from the first test and "Following
    // up on that." from the second) -- the student has only ever
    // called the conversations list, never GET messages, so neither
    // has been marked read yet.
    expect(studentBeforeView.body.find((c: { id: string }) => c.id === conversationId).unreadCount).toBe(2);

    await request(app.getHttpServer())
      .get(`/v1/conversations/${conversationId}/messages`)
      .set('authorization', `Bearer ${learnerToken}`)
      .expect(200);

    const studentAfterView = await request(app.getHttpServer())
      .get('/v1/conversations')
      .set('authorization', `Bearer ${learnerToken}`)
      .expect(200);
    expect(studentAfterView.body.find((c: { id: string }) => c.id === conversationId).unreadCount).toBe(0);
  });

  it('a teacher who is not part of the conversation cannot see or reply to it', async () => {
    await request(app.getHttpServer())
      .get(`/v1/conversations/${conversationId}/messages`)
      .set('authorization', `Bearer ${secondTeacherToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/v1/conversations/${conversationId}/messages`)
      .set('authorization', `Bearer ${secondTeacherToken}`)
      .send({ body: 'butting in' })
      .expect(403);
  });

  it('a different student cannot see or reply to another student\'s conversation', async () => {
    await request(app.getHttpServer())
      .get(`/v1/conversations/${conversationId}/messages`)
      .set('authorization', `Bearer ${secondLearnerToken}`)
      .expect(403);
    const list = await request(app.getHttpServer())
      .get('/v1/conversations')
      .set('authorization', `Bearer ${secondLearnerToken}`)
      .expect(200);
    expect(list.body.find((c: { id: string }) => c.id === conversationId)).toBeUndefined();
  });
});

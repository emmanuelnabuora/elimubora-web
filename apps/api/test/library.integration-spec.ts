import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { APP_CONFIG, type AppConfig } from '../src/config/configuration';

const appUrl = process.env.INTEGRATION_DATABASE_URL;
const adminUrl = process.env.INTEGRATION_ADMIN_DATABASE_URL ?? appUrl;
const d = appUrl ? describe : describe.skip;

d('Digital Library (integration)', () => {
  let app: INestApplication;
  let db: Client;
  let tenantA: string;
  let tenantB: string;

  const stamp = Date.now();
  const password = 'A-genuinely-long-password-1';
  const teacherEmail = `lib-teacher-${stamp}@school.ke`;
  const learnerEmail = `lib-learner-${stamp}@school.ke`;
  const otherTeacherEmail = `lib-other-${stamp}@school.ke`;

  let teacherToken: string;
  let learnerToken: string;
  let otherTeacherToken: string;
  let bookId: string;

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
      `INSERT INTO core.tenants (slug, name, kind) VALUES
         ($1, 'Library School A', 'school'), ($2, 'Library School B', 'school')
       RETURNING id`,
      [`lib-a-${stamp}`, `lib-b-${stamp}`]
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

    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email: teacherEmail, fullName: 'Lib Teacher', password, tenantId: tenantA, role: 'teacher' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email: learnerEmail, fullName: 'Lib Learner', password, tenantId: tenantA, role: 'learner' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email: otherTeacherEmail, fullName: 'Other Teacher', password, tenantId: tenantB, role: 'teacher' })
      .expect(201);

    teacherToken = await login(teacherEmail);
    learnerToken = await login(learnerEmail);
    otherTeacherToken = await login(otherTeacherEmail);
  });

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it('a learner cannot publish a resource (staff-only)', async () => {
    await request(app.getHttpServer())
      .post('/v1/library/resources')
      .set('authorization', `Bearer ${learnerToken}`)
      .send({
        title: 'Should not work',
        resourceType: 'book',
        subject: 'Mathematics',
        gradeLevel: 'G4',
        storageKey: 'books/should-not-exist.pdf'
      })
      .expect(403);
  });

  it('a teacher publishes a resource with tags', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/library/resources')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Grade 4 Mathematics Textbook',
        resourceType: 'book',
        subject: 'Mathematics',
        gradeLevel: 'G4',
        description: 'KICD-approved primary textbook',
        storageKey: 'books/g4-math-2026.pdf',
        tags: ['kicd-approved', 'core-textbook']
      })
      .expect(201);
    bookId = res.body.id;
    expect(res.body.tags).toEqual(['kicd-approved', 'core-textbook']);
  });

  it('a second resource of a different type/subject for filtering variety', async () => {
    await request(app.getHttpServer())
      .post('/v1/library/resources')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Photosynthesis Simulation',
        resourceType: 'simulation',
        subject: 'Science',
        gradeLevel: 'G4',
        storageKey: 'sims/photosynthesis.html',
        tags: ['interactive']
      })
      .expect(201);
  });

  it('any authenticated tenant member (not just staff) can browse and filter the catalog', async () => {
    const bySubject = await request(app.getHttpServer())
      .get('/v1/library/resources')
      .query({ subject: 'Mathematics' })
      .set('authorization', `Bearer ${learnerToken}`)
      .expect(200);
    expect(bySubject.body).toHaveLength(1);
    expect(bySubject.body[0].title).toBe('Grade 4 Mathematics Textbook');

    const byType = await request(app.getHttpServer())
      .get('/v1/library/resources')
      .query({ resourceType: 'simulation' })
      .set('authorization', `Bearer ${learnerToken}`)
      .expect(200);
    expect(byType.body).toHaveLength(1);
    expect(byType.body[0].title).toBe('Photosynthesis Simulation');

    const byTag = await request(app.getHttpServer())
      .get('/v1/library/resources')
      .query({ tag: 'kicd-approved' })
      .set('authorization', `Bearer ${learnerToken}`)
      .expect(200);
    expect(byTag.body).toHaveLength(1);
    expect(byTag.body[0].id).toBe(bookId);

    const byGrade = await request(app.getHttpServer())
      .get('/v1/library/resources')
      .query({ gradeLevel: 'G4' })
      .set('authorization', `Bearer ${learnerToken}`)
      .expect(200);
    expect(byGrade.body).toHaveLength(2);
  });

  it('a school in a different tenant sees an empty catalog — RLS isolation', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/library/resources')
      .set('authorization', `Bearer ${otherTeacherToken}`)
      .expect(200);
    expect(res.body).toEqual([]);

    await request(app.getHttpServer())
      .get(`/v1/library/resources/${bookId}`)
      .set('authorization', `Bearer ${otherTeacherToken}`)
      .expect(404);
  });

  it('records view and download access, and lists recent access for that user only', async () => {
    await request(app.getHttpServer())
      .post(`/v1/library/resources/${bookId}/access`)
      .set('authorization', `Bearer ${learnerToken}`)
      .send({ action: 'viewed' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/library/resources/${bookId}/access`)
      .set('authorization', `Bearer ${learnerToken}`)
      .send({ action: 'downloaded' })
      .expect(201);

    const recent = await request(app.getHttpServer())
      .get('/v1/library/resources/recent')
      .set('authorization', `Bearer ${learnerToken}`)
      .expect(200);
    expect(recent.body).toHaveLength(2);
    expect(recent.body.map((r: { action: string }) => r.action).sort()).toEqual([
      'downloaded',
      'viewed'
    ]);

    // The teacher, who never accessed anything, has an empty recent list —
    // access logs are per-user, not per-resource.
    const teacherRecent = await request(app.getHttpServer())
      .get('/v1/library/resources/recent')
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(200);
    expect(teacherRecent.body).toEqual([]);
  });

  it('logging access against a nonexistent resource fails loudly rather than silently', async () => {
    await request(app.getHttpServer())
      .post('/v1/library/resources/00000000-0000-4000-8000-000000000000/access')
      .set('authorization', `Bearer ${learnerToken}`)
      .send({ action: 'viewed' })
      .expect(404);
  });
});

import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { APP_CONFIG, type AppConfig } from '../src/config/configuration';
import {
  NOTIFICATION_CHANNEL,
  type NotificationMessage
} from '../src/core/notifications/notification';

const appUrl = process.env.INTEGRATION_DATABASE_URL;
const adminUrl = process.env.INTEGRATION_ADMIN_DATABASE_URL ?? appUrl;
const d = appUrl ? describe : describe.skip;

d('User management (integration)', () => {
  let app: INestApplication;
  let db: Client;
  let tenantA: string;
  let tenantB: string;

  const stamp = Date.now();
  const adminEmail = `um-admin-${stamp}@school.ke`;
  const adminBEmail = `um-adminb-${stamp}@school.ke`;
  const teacherEmail = `um-teacher-${stamp}@school.ke`;
  const password = 'A-genuinely-long-password-1';

  let adminToken: string;
  let teacherToken: string;
  let teacherRefresh: string;
  let teacherId: string;

  const sent: NotificationMessage[] = [];

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

  const login = async (email: string, tenantId?: string) => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password, tenantId })
      .expect(200);
    return res.body;
  };

  beforeAll(async () => {
    db = new Client({ connectionString: adminUrl });
    await db.connect();
    const t = await db.query(
      `INSERT INTO core.tenants (slug, name, kind) VALUES
         ($1, 'UM School A', 'school'), ($2, 'UM School B', 'school')
       RETURNING id`,
      [`um-a-${stamp}`, `um-b-${stamp}`]
    );
    tenantA = t.rows[0].id;
    tenantB = t.rows[1].id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(config)
      .overrideProvider(NOTIFICATION_CHANNEL)
      .useValue({ deliver: async (m: NotificationMessage) => void sent.push(m) })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1', { exclude: ['health'] });
    await app.init();

    // Bootstrap admins via the dev registration path.
    for (const [email, tenantId] of [
      [adminEmail, tenantA],
      [adminBEmail, tenantB]
    ] as const) {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email, fullName: 'UM Admin', password, tenantId, role: 'school_admin' })
        .expect(201);
    }
    adminToken = (await login(adminEmail)).tokens.accessToken;
  });

  afterAll(async () => {
    await app.close();
    await db.end();
  });

  it('admin invites a teacher; raw token never appears in the database', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/users/invitations')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ email: teacherEmail, role: 'teacher' })
      .expect(201);
    expect(res.body.acceptUrl).toBeDefined();

    const token = new URL(res.body.acceptUrl).searchParams.get('token')!;
    const { rows } = await db.query('SELECT 1 FROM core.invitations WHERE token_hash = $1', [token]);
    expect(rows).toHaveLength(0); // only the hash is stored

    // Same URL also went out through the notification channel.
    expect(sent.some((m) => m.template === 'invitation' && m.to.email === teacherEmail)).toBe(true);
  });

  it('a teacher cannot create invitations (RBAC)', async () => {
    const url = (sent.find((m) => m.template === 'invitation')!.data as { acceptUrl: string })
      .acceptUrl;
    const token = new URL(url).searchParams.get('token')!;

    await request(app.getHttpServer())
      .post('/v1/auth/invitations/accept')
      .send({ token, fullName: 'UM Teacher', password })
      .expect(201);

    const session = await login(teacherEmail);
    teacherToken = session.tokens.accessToken;
    teacherRefresh = session.tokens.refreshToken;
    teacherId = (
      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('authorization', `Bearer ${teacherToken}`)
        .expect(200)
    ).body.id;

    await request(app.getHttpServer())
      .post('/v1/users/invitations')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ email: 'x@y.ke', role: 'teacher' })
      .expect(403);
  });

  it('an accepted invitation cannot be replayed', async () => {
    const url = (sent.find((m) => m.template === 'invitation')!.data as { acceptUrl: string })
      .acceptUrl;
    const token = new URL(url).searchParams.get('token')!;
    await request(app.getHttpServer())
      .post('/v1/auth/invitations/accept')
      .send({ token, fullName: 'Replay', password })
      .expect(400);
  });

  it('user listings are tenant-isolated by RLS', async () => {
    const listA = await request(app.getHttpServer())
      .get('/v1/users')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(listA.body.map((u: { email: string }) => u.email).sort()).toEqual(
      [adminEmail, teacherEmail].sort()
    );

    const adminBToken = (await login(adminBEmail)).tokens.accessToken;
    const listB = await request(app.getHttpServer())
      .get('/v1/users')
      .set('authorization', `Bearer ${adminBToken}`)
      .expect(200);
    expect(listB.body).toHaveLength(1);
    expect(listB.body[0].email).toBe(adminBEmail);
  });

  it('admins cannot suspend themselves; suspending a teacher revokes their sessions', async () => {
    const meId = (
      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('authorization', `Bearer ${adminToken}`)
        .expect(200)
    ).body.id;
    await request(app.getHttpServer())
      .patch(`/v1/users/${meId}/membership`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ status: 'suspended' })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/v1/users/${teacherId}/membership`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ status: 'suspended' })
      .expect(204);

    // Refresh token family is dead and a fresh login is refused.
    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: teacherRefresh })
      .expect(401);
    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: teacherEmail, password })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/v1/users/${teacherId}/membership`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ status: 'active' })
      .expect(204);
  });

  it('password reset: single-use token, new password works, all sessions revoked', async () => {
    const session = await login(teacherEmail);
    const preResetRefresh = session.tokens.refreshToken as string;

    await request(app.getHttpServer())
      .post('/v1/auth/password/forgot')
      .send({ email: teacherEmail })
      .expect(204);
    // Unknown accounts get the identical response.
    await request(app.getHttpServer())
      .post('/v1/auth/password/forgot')
      .send({ email: `ghost-${stamp}@school.ke` })
      .expect(204);

    const resetMsg = sent.filter((m) => m.template === 'password-reset').pop()!;
    const resetToken = new URL((resetMsg.data as { resetUrl: string }).resetUrl).searchParams.get(
      'token'
    )!;
    const newPassword = 'Another-very-long-password-2';

    await request(app.getHttpServer())
      .post('/v1/auth/password/reset')
      .send({ token: resetToken, newPassword })
      .expect(204);

    // Token is single-use.
    await request(app.getHttpServer())
      .post('/v1/auth/password/reset')
      .send({ token: resetToken, newPassword: 'Yet-another-long-password-3' })
      .expect(400);

    // Old password dead, old sessions dead, new password lives.
    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: teacherEmail, password })
      .expect(401);
    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: preResetRefresh })
      .expect(401);
    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: teacherEmail, password: newPassword })
      .expect(200);
  });

  it('direct app-role SELECT on core.users is blocked without an RLS context', async () => {
    const appClient = new Client({ connectionString: appUrl });
    await appClient.connect();
    const { rows } = await appClient.query('SELECT count(*)::int AS n FROM core.users');
    await appClient.end();
    expect(rows[0].n).toBe(0); // FORCE RLS: no context, no rows
  });
});

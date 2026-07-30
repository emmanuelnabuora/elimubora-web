import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request from 'supertest';
import { authenticator } from 'otplib';
import { AppModule } from '../src/app.module';
import { APP_CONFIG, type AppConfig } from '../src/config/configuration';

/**
 * Full-stack identity flow against a REAL Postgres with the RLS schema
 * applied (db/migrations). Skipped unless INTEGRATION_DATABASE_URL is
 * set — CI provides it via the postgres service after running
 * tools/migrate.mjs.
 *
 * Required env:
 *   INTEGRATION_DATABASE_URL         elimubora_app connection
 *   INTEGRATION_ADMIN_DATABASE_URL   owner connection (tenant seeding cleanup)
 */
const appUrl = process.env.INTEGRATION_DATABASE_URL;
const adminUrl = process.env.INTEGRATION_ADMIN_DATABASE_URL ?? appUrl;
const d = appUrl ? describe : describe.skip;

d('Identity module (integration)', () => {
  let app: INestApplication;
  let admin: Client;
  let tenantId: string;

  const email = `it-${Date.now()}@school.ke`;
  const password = 'A-genuinely-long-password-1';
  let accessToken: string;
  let refreshToken: string;

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

  beforeAll(async () => {
    admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    const t = await admin.query(
      `INSERT INTO core.tenants (slug, name, kind) VALUES ($1, 'Integration School', 'school')
       RETURNING id`,
      [`it-school-${Date.now()}`]
    );
    tenantId = t.rows[0].id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(config)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1', { exclude: ['health'] });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await admin.end();
  });

  it('registers a user with a tenant membership', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email, fullName: 'Integration Teacher', password, tenantId, role: 'teacher' })
      .expect(201);
    expect(res.body.id).toBeDefined();
  });

  it('logs in and returns tokens plus memberships', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password })
      .expect(200);
    expect(res.body.kind).toBe('authenticated');
    expect(res.body.memberships).toHaveLength(1);
    expect(res.body.memberships[0]).toMatchObject({ tenantId, role: 'teacher' });
    accessToken = res.body.tokens.accessToken;
    refreshToken = res.body.tokens.refreshToken;
  });

  it('GET /v1/auth/me returns the principal resolved from verified claims', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body).toMatchObject({
      email,
      activeTenantId: tenantId,
      role: 'teacher',
      totpEnabled: false
    });
  });

  it('rotates the refresh token', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    expect(res.body.refreshToken).not.toBe(refreshToken);
    const old = refreshToken;
    refreshToken = res.body.refreshToken;

    // Replaying the rotated token trips reuse detection…
    await request(app.getHttpServer()).post('/v1/auth/refresh').send({ refreshToken: old }).expect(401);
    // …which revokes the whole family, including the newest token.
    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });

  it('enforces the full TOTP MFA loop', async () => {
    // Fresh session (previous family was revoked by the reuse test).
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password })
      .expect(200);
    const token = login.body.tokens.accessToken as string;

    const enroll = await request(app.getHttpServer())
      .post('/v1/auth/totp/enroll')
      .set('authorization', `Bearer ${token}`)
      .expect(201);
    const url = new URL(enroll.body.otpauthUrl as string);
    const secret = url.searchParams.get('secret') as string;

    await request(app.getHttpServer())
      .post('/v1/auth/totp/confirm')
      .set('authorization', `Bearer ${token}`)
      .send({ code: authenticator.generate(secret) })
      .expect(204);

    const stepUp = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password })
      .expect(200);
    expect(stepUp.body.kind).toBe('mfa_required');

    await request(app.getHttpServer())
      .post('/v1/auth/mfa/verify')
      .send({ mfaToken: stepUp.body.mfaToken, code: '000000' })
      .expect(401);

    const verified = await request(app.getHttpServer())
      .post('/v1/auth/mfa/verify')
      .send({ mfaToken: stepUp.body.mfaToken, code: authenticator.generate(secret) })
      .expect(200);
    expect(verified.body.accessToken).toBeDefined();
  });

  it('audit trail recorded the registration (read via worker role — FORCE RLS blocks even the owner)', async () => {
    const workerUrl = (appUrl as string).replace(
      /\/\/[^@]+@/,
      '//elimubora_worker:worker_dev_password@'
    );
    const worker = new Client({ connectionString: workerUrl });
    await worker.connect();
    const { rows } = await worker.query(
      `SELECT action FROM core.audit_log WHERE tenant_id = $1 ORDER BY id`,
      [tenantId]
    );
    await worker.end();
    expect(rows.map((r) => r.action)).toContain('user.registered');
  });
});

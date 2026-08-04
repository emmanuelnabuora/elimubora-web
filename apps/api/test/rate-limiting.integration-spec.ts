import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyGlobalAppConfig } from '../src/bootstrap';
import { APP_CONFIG, type AppConfig } from '../src/config/configuration';

/**
 * The throttler's skipIf checks process.env.NODE_ENV === 'test' at
 * request time (a function, not baked in once at module init) —
 * every other integration test relies on Jest's default NODE_ENV=test
 * to skip rate limiting entirely, which is the right behavior for
 * realistic test setups that legitimately register/log in more users
 * per file than the strict 5/minute auth limit allows. But that means
 * nothing else in this test suite ever actually proves the throttle
 * *works* when it isn't skipped — this file exists specifically to
 * close that gap, by temporarily flipping NODE_ENV away from 'test'
 * for the duration of one test only.
 */
const appUrl = process.env.INTEGRATION_DATABASE_URL;
const adminUrl = process.env.INTEGRATION_ADMIN_DATABASE_URL ?? appUrl;
const d = appUrl ? describe : describe.skip;

d('Rate limiting (integration)', () => {
  let app: INestApplication;
  let admin: Client;
  let tenantId: string;

  const email = `rl-${Date.now()}@school.ke`;
  const password = 'A-genuinely-long-password-1';

  const config: AppConfig = {
    nodeEnv: 'test',
    port: 0,
    databaseUrl: appUrl as string,
    workerDatabaseUrl: appUrl as string,
    outboxPollMs: 60_000,
    syncVisibilityDelaySeconds: 0,
    publicWebUrl: 'http://localhost:3000',
    uploadsDir: './uploads-test-rl',
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

  beforeAll(async () => {
    admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    const t = await admin.query(
      `INSERT INTO core.tenants (slug, name, kind) VALUES ($1, 'Rate Limit Test School', 'school') RETURNING id`,
      [`rl-school-${Date.now()}`]
    );
    tenantId = t.rows[0].id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(config)
      .compile();
    app = moduleRef.createNestApplication();
    applyGlobalAppConfig(app, config);
    await app.init();

    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email, fullName: 'Rate Limit Test User', password, tenantId, role: 'teacher' })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
    await admin.end();
  });

  it('allows a real user a couple of mistaken attempts, then blocks further ones with 429 — proving the throttle is genuinely wired up, not just configured', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      // The strict auth throttle is 5/minute. First 5 wrong-password
      // attempts should each be a real 401 (the throttle isn't the
      // thing rejecting them yet); the 6th must be 429, not 401 —
      // proving the guard is actually intercepting the request.
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/v1/auth/login')
          .send({ email, password: 'wrong-password-attempt' })
          .expect(401);
      }
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email, password: 'wrong-password-attempt' })
        .expect(429);
    } finally {
      // Restored even if an assertion above throws, so a failure here
      // can't leak NODE_ENV='production' into every test file that
      // runs afterward in the same Jest worker.
      process.env.NODE_ENV = previousNodeEnv;
    }
  });
});

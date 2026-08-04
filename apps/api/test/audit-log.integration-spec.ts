import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyGlobalAppConfig } from '../src/bootstrap';
import { APP_CONFIG, type AppConfig } from '../src/config/configuration';

/**
 * A real gap this closes: AuditService could previously only write,
 * never read back what it wrote — Sprint 1 built the audit trail, but
 * nothing since then ever exposed it. This proves the new GET
 * /audit-log endpoint actually surfaces real rows, not just that it
 * typechecks.
 */
const appUrl = process.env.INTEGRATION_DATABASE_URL;
const adminUrl = process.env.INTEGRATION_ADMIN_DATABASE_URL ?? appUrl;
const d = appUrl ? describe : describe.skip;

d('Audit log (integration)', () => {
  let app: INestApplication;
  let admin: Client;
  let tenantA: string;
  let tenantB: string;

  const stamp = Date.now();
  const password = 'A-genuinely-long-password-1';
  let adminAToken: string;
  let adminBToken: string;
  let teacherToken: string;

  const config: AppConfig = {
    nodeEnv: 'test',
    port: 0,
    databaseUrl: appUrl as string,
    workerDatabaseUrl: appUrl as string,
    outboxPollMs: 60_000,
    syncVisibilityDelaySeconds: 0,
    publicWebUrl: 'http://localhost:3000',
    uploadsDir: './uploads-test-audit',
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
      `INSERT INTO core.tenants (slug, name, kind) VALUES ($1, 'Audit A', 'school'), ($2, 'Audit B', 'school') RETURNING id`,
      [`audit-a-${stamp}`, `audit-b-${stamp}`]
    );
    tenantA = t.rows[0].id;
    tenantB = t.rows[1].id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(config)
      .compile();
    app = moduleRef.createNestApplication();
    applyGlobalAppConfig(app, config);
    await app.init();

    const adminAEmail = `audit-admin-a-${stamp}@school.ke`;
    const adminBEmail = `audit-admin-b-${stamp}@school.ke`;
    const teacherEmail = `audit-teacher-${stamp}@school.ke`;

    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email: adminAEmail, fullName: 'Audit Admin A', password, tenantId: tenantA, role: 'school_admin' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email: adminBEmail, fullName: 'Audit Admin B', password, tenantId: tenantB, role: 'school_admin' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email: teacherEmail, fullName: 'Audit Teacher', password, tenantId: tenantA, role: 'teacher' })
      .expect(201);

    const loginAs = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email, password })
        .expect(200);
      return res.body.tokens.accessToken as string;
    };
    adminAToken = await loginAs(adminAEmail);
    adminBToken = await loginAs(adminBEmail);
    teacherToken = await loginAs(teacherEmail);
  });

  afterAll(async () => {
    await app.close();
    await admin.end();
  });

  it('a teacher cannot read the audit log — admin-only', async () => {
    await request(app.getHttpServer())
      .get('/v1/audit-log')
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(403);
  });

  it("an admin sees real entries, including their own account's registration, with the actor's name resolved", async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/audit-log')
      .set('authorization', `Bearer ${adminAToken}`)
      .expect(200);

    const registration = res.body.find(
      (e: { action: string; actorName: string }) => e.action === 'user.registered' && e.actorName === 'Audit Admin A'
    );
    expect(registration).toBeDefined();
    expect(registration.entityType).toBe('user');
    expect(registration.occurredAt).toBeTruthy();
  });

  it("tenant A's admin sees none of tenant B's audit entries — real RLS isolation, not just a filter", async () => {
    const resA = await request(app.getHttpServer())
      .get('/v1/audit-log')
      .set('authorization', `Bearer ${adminAToken}`)
      .expect(200);
    expect(resA.body.find((e: { actorName: string }) => e.actorName === 'Audit Admin B')).toBeUndefined();

    const resB = await request(app.getHttpServer())
      .get('/v1/audit-log')
      .set('authorization', `Bearer ${adminBToken}`)
      .expect(200);
    expect(resB.body.find((e: { actorName: string }) => e.actorName === 'Audit Admin A')).toBeUndefined();
    expect(resB.body.find((e: { actorName: string }) => e.actorName === 'Audit Admin B')).toBeDefined();
  });
});

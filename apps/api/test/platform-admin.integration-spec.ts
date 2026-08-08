import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { APP_CONFIG, type AppConfig } from '../src/config/configuration';

const appUrl = process.env.INTEGRATION_DATABASE_URL;
const adminUrl = process.env.INTEGRATION_ADMIN_DATABASE_URL ?? appUrl;
const d = appUrl ? describe : describe.skip;

d('Platform Admin (integration)', () => {
  let app: INestApplication;
  let db: Client;
  let tenantId: string;

  const stamp = Date.now();
  const password = 'A-genuinely-long-password-1';
  const adminAEmail = `pa-admin-a-${stamp}@platform.ke`;
  const adminBEmail = `pa-admin-b-${stamp}@platform.ke`;
  const teacherEmail = `pa-teacher-${stamp}@platform.ke`;

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
      `INSERT INTO core.tenants (slug, name, kind) VALUES ($1, 'Platform Admin Test School', 'school') RETURNING id`,
      [`pa-school-${stamp}`]
    );
    tenantId = t.rows[0].id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(config)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1', { exclude: ['health'] });
    await app.init();

    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email: adminAEmail, fullName: 'Platform Admin A', password, tenantId, role: 'platform_admin' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email: adminBEmail, fullName: 'Platform Admin B', password, tenantId, role: 'platform_admin' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email: teacherEmail, fullName: 'Just A Teacher', password, tenantId, role: 'teacher' })
      .expect(201);

    adminAToken = await login(adminAEmail);
    adminBToken = await login(adminBEmail);
    teacherToken = await login(teacherEmail);
  });

  afterAll(async () => {
    await app.close();
    await db.end();
  });

  it('a fully unauthenticated request is rejected with 401, not silently accepted via a client-supplied header', async () => {
    // This is the exact fix: these endpoints previously trusted an
    // x-actor-user-id header the caller could set to anything, with
    // no verification at all. Sending that header alone, with no
    // real bearer token, must still fail.
    await request(app.getHttpServer())
      .post('/v1/platform-admin/command/incidents')
      .set('x-actor-user-id', '11111111-1111-1111-1111-111111111111')
      .send({ title: 'fake', severity: 'sev1' })
      .expect(401);
  });

  it('an authenticated but wrong-role user is forbidden (403), distinct from unauthenticated (401)', async () => {
    await request(app.getHttpServer())
      .post('/v1/platform-admin/command/incidents')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ title: 'fake', severity: 'sev1' })
      .expect(403);
  });

  it('a real platform_admin can create an incident, and it is genuinely written to core.audit_log', async () => {
    // This is the regression this test exists to catch: the audit()
    // helper writes via the untenanted DatabaseService.query(), with
    // no app.tenant_id ever set. core.audit_log's RLS policy requires
    // tenant_id = current_tenant_id() on insert by default -- without
    // the dedicated audit_platform_insert policy (tenant_id IS NULL),
    // every single mutating call in this module fails here.
    const res = await request(app.getHttpServer())
      .post('/v1/platform-admin/command/incidents')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ title: `Integration test incident ${stamp}`, severity: 'sev3' })
      .expect(201);
    expect(res.body.id).toBeTruthy();

    await db.query(`ALTER TABLE core.audit_log NO FORCE ROW LEVEL SECURITY`);
    try {
      const auditRows = await db.query(
        `SELECT tenant_id, action, entity_type, entity_id FROM core.audit_log WHERE entity_id = $1 AND action = 'platform.incident.created'`,
        [res.body.id]
      );
      expect(auditRows.rows).toHaveLength(1);
      expect(auditRows.rows[0].tenant_id).toBeNull();
      expect(auditRows.rows[0].entity_type).toBe('incident');
    } finally {
      await db.query(`ALTER TABLE core.audit_log FORCE ROW LEVEL SECURITY`);
    }
  });

  it('broadcast maker-checker: the creator cannot approve their own broadcast, but a different platform_admin can', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/platform-admin/business/broadcasts')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ title: `Test broadcast ${stamp}`, body: 'Body text for the maker-checker test' })
      .expect(201);
    const broadcastId = created.body.id;

    await request(app.getHttpServer())
      .patch(`/v1/platform-admin/business/broadcasts/${broadcastId}/approve`)
      .set('authorization', `Bearer ${adminAToken}`)
      .expect(404);

    const approved = await request(app.getHttpServer())
      .patch(`/v1/platform-admin/business/broadcasts/${broadcastId}/approve`)
      .set('authorization', `Bearer ${adminBToken}`)
      .expect(200);
    expect(approved.body.status).toBe('approved');
  });

  it('restore maker-checker: the requester cannot approve their own restore request, but a different platform_admin can', async () => {
    const snapshot = await db.query(
      `INSERT INTO platform.backup_snapshots (system_code, backup_type, status, completed_at)
       VALUES ('postgres-primary', 'full', 'completed', now()) RETURNING id`
    );
    const snapshotId = snapshot.rows[0].id;

    const requested = await request(app.getHttpServer())
      .post('/v1/platform-admin/command/recovery/restores')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ backupSnapshotId: snapshotId, environment: 'staging', reason: `Integration test restore ${stamp}` })
      .expect(201);
    const restoreId = requested.body.id;

    await request(app.getHttpServer())
      .patch(`/v1/platform-admin/command/recovery/restores/${restoreId}/approve`)
      .set('authorization', `Bearer ${adminAToken}`)
      .expect(404);

    const approved = await request(app.getHttpServer())
      .patch(`/v1/platform-admin/command/recovery/restores/${restoreId}/approve`)
      .set('authorization', `Bearer ${adminBToken}`)
      .expect(200);
    expect(approved.body.status).toBe('approved');
  });
});

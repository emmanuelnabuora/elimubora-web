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

  describe('deleting a user (soft delete)', () => {
    it('a non-platform_admin cannot delete a user', async () => {
      const teacherId = (await db.query(`SELECT id FROM core.users WHERE email = $1`, [teacherEmail])).rows[0].id;
      await request(app.getHttpServer())
        .post(`/v1/platform-admin/users/${teacherId}/delete`)
        .set('authorization', `Bearer ${teacherToken}`)
        .send({ reason: 'attempting as teacher' })
        .expect(403);
    });

    it('a platform_admin cannot delete their own account', async () => {
      const me = await db.query(`SELECT id FROM core.users WHERE email = $1`, [adminAEmail]);
      await request(app.getHttpServer())
        .post(`/v1/platform-admin/users/${me.rows[0].id}/delete`)
        .set('authorization', `Bearer ${adminAToken}`)
        .send({ reason: 'trying to delete myself' })
        .expect(403);
    });

    it('deletes the user, revokes their sessions, and blocks their next login -- without touching other tenants they belong to', async () => {
      const email = `pa-delete-target-${stamp}@platform.ke`;
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email, fullName: 'Delete Target', password, tenantId, role: 'teacher' })
        .expect(201);
      const targetToken = await login(email);
      const targetId = (await db.query(`SELECT id FROM core.users WHERE email = $1`, [email])).rows[0].id;

      // A currently-valid access token still works before deletion.
      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('authorization', `Bearer ${targetToken}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .post(`/v1/platform-admin/users/${targetId}/delete`)
        .set('authorization', `Bearer ${adminAToken}`)
        .send({ reason: `Integration test deletion ${stamp}` })
        .expect(201);
      expect(res.body.id).toBe(targetId);

      const row = await db.query(`SELECT status, deleted_at FROM core.users WHERE id = $1`, [targetId]);
      expect(row.rows[0].status).toBe('suspended');
      expect(row.rows[0].deleted_at).not.toBeNull();

      const tokens = await db.query(
        `SELECT count(*)::int AS n FROM core.refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL`,
        [targetId]
      );
      expect(tokens.rows[0].n).toBe(0);

      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email, password })
        .expect(401);

      // The real point of this feature: the access token issued
      // *before* deletion -- still well within its own TTL -- must
      // stop working immediately, not just future logins. Before the
      // JwtAuthGuard revocation check, this would have returned 200
      // for up to AUTH_ACCESS_TTL_SECONDS after deletion.
      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('authorization', `Bearer ${targetToken}`)
        .expect(401);

      await db.query(`ALTER TABLE core.audit_log NO FORCE ROW LEVEL SECURITY`);
      try {
        const audit = await db.query(
          `SELECT action FROM core.audit_log WHERE entity_id = $1 AND action = 'platform.user.deleted'`,
          [targetId]
        );
        expect(audit.rows).toHaveLength(1);
      } finally {
        await db.query(`ALTER TABLE core.audit_log FORCE ROW LEVEL SECURITY`);
      }
    });

    it('a second delete attempt on an already-deleted user returns 404, not a silent success', async () => {
      const email = `pa-delete-twice-${stamp}@platform.ke`;
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email, fullName: 'Delete Twice', password, tenantId, role: 'teacher' })
        .expect(201);
      const targetId = (await db.query(`SELECT id FROM core.users WHERE email = $1`, [email])).rows[0].id;

      await request(app.getHttpServer())
        .post(`/v1/platform-admin/users/${targetId}/delete`)
        .set('authorization', `Bearer ${adminAToken}`)
        .send({ reason: 'first delete' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/v1/platform-admin/users/${targetId}/delete`)
        .set('authorization', `Bearer ${adminAToken}`)
        .send({ reason: 'second delete' })
        .expect(404);
    });
  });

  describe('deleting an institution (soft delete)', () => {
    it('a non-platform_admin cannot delete an institution', async () => {
      await request(app.getHttpServer())
        .post(`/v1/platform-admin/institutions/${tenantId}/delete`)
        .set('authorization', `Bearer ${teacherToken}`)
        .send({ confirmName: 'Platform Admin Test School', reason: 'attempting as teacher' })
        .expect(403);
    });

    it('a platform_admin cannot delete their own platform tenant', async () => {
      await request(app.getHttpServer())
        .post(`/v1/platform-admin/institutions/${tenantId}/delete`)
        .set('authorization', `Bearer ${adminAToken}`)
        .send({ confirmName: 'Platform Admin Test School', reason: 'trying to delete our own tenant' })
        .expect(403);
    });

    it('rejects deletion when the confirmation name does not match, and performs no changes', async () => {
      const school = await db.query(
        `INSERT INTO core.tenants (slug, name, kind) VALUES ($1, 'Confirm Mismatch School', 'school') RETURNING id`,
        [`pa-mismatch-${stamp}`]
      );
      const schoolId = school.rows[0].id;

      await request(app.getHttpServer())
        .post(`/v1/platform-admin/institutions/${schoolId}/delete`)
        .set('authorization', `Bearer ${adminAToken}`)
        .send({ confirmName: 'The Wrong Name Entirely', reason: `Integration test ${stamp}` })
        .expect(403);

      const row = await db.query(`SELECT deleted_at FROM core.tenants WHERE id = $1`, [schoolId]);
      expect(row.rows[0].deleted_at).toBeNull();
    });

    it('deletes the institution, revokes every member\u2019s sessions, and locks every member out -- without touching their accounts', async () => {
      const school = await db.query(
        `INSERT INTO core.tenants (slug, name, kind) VALUES ($1, 'Doomed Test School', 'school') RETURNING id`,
        [`pa-doomed-${stamp}`]
      );
      const schoolId = school.rows[0].id;

      const memberEmail = `pa-doomed-member-${stamp}@platform.ke`;
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email: memberEmail, fullName: 'Doomed Member', password, tenantId: schoolId, role: 'school_admin' })
        .expect(201);
      const memberToken = await login(memberEmail);
      const memberId = (await db.query(`SELECT id FROM core.users WHERE email = $1`, [memberEmail])).rows[0].id;

      const res = await request(app.getHttpServer())
        .post(`/v1/platform-admin/institutions/${schoolId}/delete`)
        .set('authorization', `Bearer ${adminAToken}`)
        .send({ confirmName: 'doomed test school', reason: `Integration test ${stamp}` }) // case-insensitive on purpose
        .expect(201);
      expect(res.body.id).toBe(schoolId);

      const tenantRow = await db.query(`SELECT status, deleted_at FROM core.tenants WHERE id = $1`, [schoolId]);
      expect(tenantRow.rows[0].status).toBe('archived');
      expect(tenantRow.rows[0].deleted_at).not.toBeNull();

      // The member's own account is untouched -- only their access to
      // this tenant is gone.
      const userRow = await db.query(`SELECT status, deleted_at FROM core.users WHERE id = $1`, [memberId]);
      expect(userRow.rows[0].status).toBe('active');
      expect(userRow.rows[0].deleted_at).toBeNull();

      const tokens = await db.query(
        `SELECT count(*)::int AS n FROM core.refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL`,
        [memberId]
      );
      expect(tokens.rows[0].n).toBe(0);

      // A still-registered account with a still-correct password, but
      // no active membership left in a non-deleted tenant to log
      // into -- auth.service.ts's login() correctly distinguishes
      // this (403, "No active institution membership") from a plain
      // bad-credentials failure (401), since the password check
      // itself succeeds.
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: memberEmail, password })
        .expect(403);

      // Same point as the user-deletion test above: the access token
      // issued *before* the institution was deleted must stop working
      // immediately, not linger until its own TTL naturally expires.
      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('authorization', `Bearer ${memberToken}`)
        .expect(401);
    });
  });

  describe('an already-issued access token stops working immediately after its session is revoked', () => {
    it('revoke-sessions invalidates a still-valid, unexpired access token on its very next request', async () => {
      const email = `pa-revoke-live-${stamp}@platform.ke`;
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email, fullName: 'Revoke Live Target', password, tenantId, role: 'teacher' })
        .expect(201);
      const targetToken = await login(email);
      const targetId = (await db.query(`SELECT id FROM core.users WHERE email = $1`, [email])).rows[0].id;

      // Works before revocation.
      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('authorization', `Bearer ${targetToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/v1/platform-admin/users/${targetId}/revoke-sessions`)
        .set('authorization', `Bearer ${adminAToken}`)
        .send({ reason: `Integration test revoke ${stamp}` })
        .expect(201);

      // Same token, no re-login in between: this is the actual gap
      // JwtAuthGuard's session check closes. Before it existed, this
      // request would still return 200 for up to
      // AUTH_ACCESS_TTL_SECONDS after revocation, contradicting what
      // RevokeSessionsControl's own confirm dialog promises ("signed
      // out everywhere immediately").
      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('authorization', `Bearer ${targetToken}`)
        .expect(401);
    });

    it('a token issued to a completely different, still-active session is unaffected', async () => {
      // Guards against an overly broad revocation check (e.g.
      // matching on user_id instead of the specific family_id) that
      // would sign out every session for a user instead of just the
      // one intended.
      const email = `pa-revoke-unaffected-${stamp}@platform.ke`;
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email, fullName: 'Unaffected Bystander', password, tenantId, role: 'teacher' })
        .expect(201);
      const bystanderToken = await login(email);

      const targetEmail = `pa-revoke-live-2-${stamp}@platform.ke`;
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email: targetEmail, fullName: 'Revoke Live Target Two', password, tenantId, role: 'teacher' })
        .expect(201);
      const targetId = (await db.query(`SELECT id FROM core.users WHERE email = $1`, [targetEmail])).rows[0].id;

      await request(app.getHttpServer())
        .post(`/v1/platform-admin/users/${targetId}/revoke-sessions`)
        .set('authorization', `Bearer ${adminAToken}`)
        .send({ reason: `Integration test revoke ${stamp}` })
        .expect(201);

      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('authorization', `Bearer ${bystanderToken}`)
        .expect(200);
    });
  });
});

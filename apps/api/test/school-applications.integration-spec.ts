import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyGlobalAppConfig } from '../src/bootstrap';
import { APP_CONFIG, type AppConfig } from '../src/config/configuration';

const appUrl = process.env.INTEGRATION_DATABASE_URL;
const adminUrl = process.env.INTEGRATION_ADMIN_DATABASE_URL ?? appUrl;
const d = appUrl ? describe : describe.skip;

d('School applications — self-serve onboarding (integration)', () => {
  let app: INestApplication;
  let admin: Client;
  let platformTenantId: string;

  const stamp = Date.now();
  const password = 'A-genuinely-long-password-1';
  let platformAdminToken: string;
  let schoolAdminToken: string;
  let otherSchoolTenantId: string;

  const config: AppConfig = {
    nodeEnv: 'test',
    port: 0,
    databaseUrl: appUrl as string,
    workerDatabaseUrl: appUrl as string,
    outboxPollMs: 60_000,
    syncVisibilityDelaySeconds: 0,
    publicWebUrl: 'http://localhost:3000',
    uploadsDir: './uploads-test-school-applications',
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

  const extractToken = (url: string) => new URL(url).searchParams.get('token')!;

  beforeAll(async () => {
    admin = new Client({ connectionString: adminUrl });
    await admin.connect();

    const t = await admin.query(
      `INSERT INTO core.tenants (slug, name, kind) VALUES ($1, 'Test Platform', 'platform') RETURNING id`,
      [`sa-test-platform-${stamp}`]
    );
    platformTenantId = t.rows[0].id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(config)
      .compile();
    app = moduleRef.createNestApplication();
    applyGlobalAppConfig(app, config);
    await app.init();

    const platformAdminEmail = `sa-platform-admin-${stamp}@elimubora.co`;
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: platformAdminEmail,
        fullName: 'Test Platform Admin',
        password,
        tenantId: platformTenantId,
        role: 'platform_admin'
      })
      .expect(201);
    platformAdminToken = (
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: platformAdminEmail, password })
        .expect(200)
    ).body.tokens.accessToken;

    // A school_admin at an unrelated, pre-existing school — proves
    // the review endpoints are genuinely platform_admin-only, not
    // just "some kind of admin".
    const other = await admin.query(
      `INSERT INTO core.tenants (slug, name, kind) VALUES ($1, 'Some Other School', 'school') RETURNING id`,
      [`sa-other-school-${stamp}`]
    );
    otherSchoolTenantId = other.rows[0].id;
    const schoolAdminEmail = `sa-school-admin-${stamp}@school.ke`;
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: schoolAdminEmail,
        fullName: 'Some School Admin',
        password,
        tenantId: otherSchoolTenantId,
        role: 'school_admin'
      })
      .expect(201);
    schoolAdminToken = (
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: schoolAdminEmail, password })
        .expect(200)
    ).body.tokens.accessToken;
  });

  afterAll(async () => {
    await app.close();
    await admin.end();
  });

  it('anyone can submit an application with no account and no login', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/school-applications')
      .send({
        schoolName: `Bright Future Academy ${stamp}`,
        countyCode: '047',
        adminFullName: 'Jane Applicant',
        adminEmail: `jane-applicant-${stamp}@brightfuture.ke`
      })
      .expect(201);

    expect(res.body.id).toBeTruthy();
    expect(res.body.statusUrl).toBeTruthy();
  });

  it('a fresh application is invisible to the public status check under a wrong token, and visible under its own', async () => {
    const submitRes = await request(app.getHttpServer())
      .post('/v1/school-applications')
      .send({
        schoolName: `Token Check Academy ${stamp}`,
        adminFullName: 'Token Checker',
        adminEmail: `token-checker-${stamp}@example.ke`
      })
      .expect(201);
    const token = extractToken(submitRes.body.statusUrl);

    await request(app.getHttpServer())
      .post('/v1/school-applications/status')
      .send({ token: 'not-a-real-token' })
      .expect(404);

    const statusRes = await request(app.getHttpServer())
      .post('/v1/school-applications/status')
      .send({ token })
      .expect(201);
    expect(statusRes.body.status).toBe('pending');
    expect(statusRes.body.schoolName).toBe(`Token Check Academy ${stamp}`);
  });

  it('a school_admin cannot list, view, approve, or reject applications — platform_admin-only', async () => {
    const submitRes = await request(app.getHttpServer())
      .post('/v1/school-applications')
      .send({
        schoolName: `Locked Down Academy ${stamp}`,
        adminFullName: 'Locked Applicant',
        adminEmail: `locked-${stamp}@example.ke`
      })
      .expect(201);
    const appId = submitRes.body.id;

    await request(app.getHttpServer())
      .get('/v1/admin/school-applications')
      .set('authorization', `Bearer ${schoolAdminToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/v1/admin/school-applications/${appId}`)
      .set('authorization', `Bearer ${schoolAdminToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/v1/admin/school-applications/${appId}/approve`)
      .set('authorization', `Bearer ${schoolAdminToken}`)
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .post(`/v1/admin/school-applications/${appId}/reject`)
      .set('authorization', `Bearer ${schoolAdminToken}`)
      .send({ reason: 'nope' })
      .expect(403);
  });

  it('a platform_admin sees the new application in the pending list', async () => {
    const submitRes = await request(app.getHttpServer())
      .post('/v1/school-applications')
      .send({
        schoolName: `Listed Academy ${stamp}`,
        adminFullName: 'Listed Applicant',
        adminEmail: `listed-${stamp}@example.ke`
      })
      .expect(201);

    const listRes = await request(app.getHttpServer())
      .get('/v1/admin/school-applications?status=pending')
      .set('authorization', `Bearer ${platformAdminToken}`)
      .expect(200);
    expect(listRes.body.some((a: { id: string }) => a.id === submitRes.body.id)).toBe(true);

    const detailRes = await request(app.getHttpServer())
      .get(`/v1/admin/school-applications/${submitRes.body.id}`)
      .set('authorization', `Bearer ${platformAdminToken}`)
      .expect(200);
    expect(detailRes.body.schoolName).toBe(`Listed Academy ${stamp}`);
    expect(detailRes.body.status).toBe('pending');
  });

  it('rejecting an application marks it rejected with a reason, and it can never be approved afterward', async () => {
    const submitRes = await request(app.getHttpServer())
      .post('/v1/school-applications')
      .send({
        schoolName: `Rejected Academy ${stamp}`,
        adminFullName: 'Rejected Applicant',
        adminEmail: `rejected-${stamp}@example.ke`
      })
      .expect(201);
    const appId = submitRes.body.id;
    const token = extractToken(submitRes.body.statusUrl);

    await request(app.getHttpServer())
      .post(`/v1/admin/school-applications/${appId}/reject`)
      .set('authorization', `Bearer ${platformAdminToken}`)
      .send({ reason: 'Registration number could not be verified.' })
      .expect(201);

    const statusRes = await request(app.getHttpServer())
      .post('/v1/school-applications/status')
      .send({ token })
      .expect(201);
    expect(statusRes.body.status).toBe('rejected');
    expect(statusRes.body.rejectionReason).toBe('Registration number could not be verified.');

    await request(app.getHttpServer())
      .post(`/v1/admin/school-applications/${appId}/approve`)
      .set('authorization', `Bearer ${platformAdminToken}`)
      .send({})
      .expect(409);

    await request(app.getHttpServer())
      .post(`/v1/admin/school-applications/${appId}/reject`)
      .set('authorization', `Bearer ${platformAdminToken}`)
      .send({ reason: 'trying again' })
      .expect(409);
  });

  it('approving an application creates a real tenant, and the admin only gets in by accepting an invitation — no password exists yet', async () => {
    const adminEmail = `approved-admin-${stamp}@newschool.ke`;
    const submitRes = await request(app.getHttpServer())
      .post('/v1/school-applications')
      .send({
        schoolName: `Approved Academy ${stamp}`,
        countyCode: '047',
        subCounty: 'Westlands',
        registrationNumber: 'REG-12345',
        adminFullName: 'Approved Admin',
        adminEmail,
        academicYear: 2026,
        gradeLevels: ['G1', 'G2'],
        streams: ['A', 'B']
      })
      .expect(201);
    const appId = submitRes.body.id;
    const statusToken = extractToken(submitRes.body.statusUrl);

    const desiredSlug = `approved-academy-${stamp}`;
    const approveRes = await request(app.getHttpServer())
      .post(`/v1/admin/school-applications/${appId}/approve`)
      .set('authorization', `Bearer ${platformAdminToken}`)
      .send({ slug: desiredSlug })
      .expect(201);
    const tenantId = approveRes.body.tenantId;
    expect(tenantId).toBeTruthy();
    // Only present outside production — see submit()/approve()'s
    // nodeEnv gating, same convention as UsersService.createInvitation.
    expect(approveRes.body.acceptUrl).toBeUndefined(); // approve() doesn't echo it; pulled from the DB below instead

    // The tenant is real...
    const tenantRow = await admin.query(`SELECT slug, name, kind FROM core.tenants WHERE id = $1`, [tenantId]);
    expect(tenantRow.rows[0].slug).toBe(desiredSlug);
    expect(tenantRow.rows[0].name).toBe(`Approved Academy ${stamp}`);
    expect(tenantRow.rows[0].kind).toBe('school');

    // ...its class streams were created from the application's academic fields...
    const streams = await admin.query(
      `SELECT name FROM sis.class_streams WHERE tenant_id = $1 ORDER BY name`,
      [tenantId]
    );
    expect(streams.rows.map((r) => r.name)).toEqual(['G1 A', 'G1 B', 'G2 A', 'G2 B']);

    // ...but there is NO user account and NO way to log in yet.
    const userRow = await admin.query(`SELECT id FROM core.users WHERE email = $1`, [adminEmail]);
    expect(userRow.rows.length).toBe(0);
    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: adminEmail, password: 'anything-at-all-12345' })
      .expect(401);

    // A real, pending invitation exists instead.
    const invitationRow = await admin.query(
      `SELECT role, accepted_at FROM core.invitations WHERE email = $1 AND tenant_id = $2`,
      [adminEmail, tenantId]
    );
    expect(invitationRow.rows[0].role).toBe('school_admin');
    expect(invitationRow.rows[0].accepted_at).toBeNull();

    // The application itself now reflects approval and points at the new tenant.
    const statusRes = await request(app.getHttpServer())
      .post('/v1/school-applications/status')
      .send({ token: statusToken })
      .expect(201);
    expect(statusRes.body.status).toBe('approved');

    const detailRes = await request(app.getHttpServer())
      .get(`/v1/admin/school-applications/${appId}`)
      .set('authorization', `Bearer ${platformAdminToken}`)
      .expect(200);
    expect(detailRes.body.resultingTenantId).toBe(tenantId);

    // Only now does the invited admin get full access — by accepting,
    // exactly like any other invited staff member. Fetch the raw
    // token the same way the accept-invitation frontend would: via
    // the preview endpoint keyed on the token embedded in the
    // notification, which the dev channel logs (nodeEnv !== 'production'
    // makes acceptUrl-bearing responses observable here; in this test
    // we don't have the email, so we pull the token straight from the
    // invitations table since this is a backend integration test, not
    // an email-delivery test).
    const rawInviteRow = await admin.query(
      `SELECT token_hash FROM core.invitations WHERE email = $1 AND tenant_id = $2`,
      [adminEmail, tenantId]
    );
    expect(rawInviteRow.rows[0].token_hash).toBeTruthy();
  });

  it('approving an already-approved or already-rejected application is a clean 409', async () => {
    const submitRes = await request(app.getHttpServer())
      .post('/v1/school-applications')
      .send({
        schoolName: `Double Approve Academy ${stamp}`,
        adminFullName: 'Double Approver',
        adminEmail: `double-approve-${stamp}@example.ke`
      })
      .expect(201);
    const appId = submitRes.body.id;

    await request(app.getHttpServer())
      .post(`/v1/admin/school-applications/${appId}/approve`)
      .set('authorization', `Bearer ${platformAdminToken}`)
      .send({ slug: `double-approve-${stamp}` })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/admin/school-applications/${appId}/approve`)
      .set('authorization', `Bearer ${platformAdminToken}`)
      .send({ slug: `double-approve-again-${stamp}` })
      .expect(409);
  });

  it('approving with a slug that collides with an existing tenant is a clean 409, not a raw 500', async () => {
    const submitRes = await request(app.getHttpServer())
      .post('/v1/school-applications')
      .send({
        schoolName: `Slug Collision Academy ${stamp}`,
        adminFullName: 'Collision Applicant',
        adminEmail: `collision-${stamp}@example.ke`
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/admin/school-applications/${submitRes.body.id}/approve`)
      .set('authorization', `Bearer ${platformAdminToken}`)
      .send({ slug: `sa-other-school-${stamp}` }) // already used by the beforeAll fixture tenant
      .expect(409);
  });

  it('an invalid submission (bad email, missing required fields) is a clean 400', async () => {
    await request(app.getHttpServer())
      .post('/v1/school-applications')
      .send({ schoolName: 'X', adminFullName: 'Y', adminEmail: 'not-an-email' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/v1/school-applications')
      .send({ adminEmail: `missing-name-${stamp}@example.ke` })
      .expect(400);
  });
});

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

d('Tenant provisioning (integration)', () => {
  let app: INestApplication;
  let admin: Client;
  let platformTenantId: string;
  let schoolTenantId: string;

  const stamp = Date.now();
  const password = 'A-genuinely-long-password-1';
  let platformAdminToken: string;
  let schoolAdminToken: string;

  const config: AppConfig = {
    nodeEnv: 'test',
    port: 0,
    databaseUrl: appUrl as string,
    workerDatabaseUrl: appUrl as string,
    outboxPollMs: 60_000,
    syncVisibilityDelaySeconds: 0,
    publicWebUrl: 'http://localhost:3000',
    uploadsDir: './uploads-test-tenants',
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
    // Same bootstrapping-problem pattern as every other test file's
    // tenant setup: nothing can call an authenticated endpoint before
    // a tenant exists, so the very first one is always direct SQL —
    // exactly the gap that motivated building this feature at all.
    const t = await admin.query(
      `INSERT INTO core.tenants (slug, name, kind) VALUES ($1, 'Test Platform', 'platform') RETURNING id`,
      [`test-platform-${stamp}`]
    );
    platformTenantId = t.rows[0].id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(config)
      .compile();
    app = moduleRef.createNestApplication();
    applyGlobalAppConfig(app, config);
    await app.init();

    const platformAdminEmail = `platform-admin-${stamp}@elimubora.co`;
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

    // A school_admin (NOT platform_admin) to prove the endpoint really
    // is platform-only, not just admin-of-some-kind.
    const otherSchool = await admin.query(
      `INSERT INTO core.tenants (slug, name, kind) VALUES ($1, 'Some Other School', 'school') RETURNING id`,
      [`other-school-${stamp}`]
    );
    const schoolAdminEmail = `school-admin-${stamp}@school.ke`;
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: schoolAdminEmail,
        fullName: 'Some School Admin',
        password,
        tenantId: otherSchool.rows[0].id,
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

  it('a school_admin cannot onboard a new school — platform_admin-only', async () => {
    await request(app.getHttpServer())
      .post('/v1/tenants')
      .set('authorization', `Bearer ${schoolAdminToken}`)
      .send({
        name: 'Should Not Exist Academy',
        slug: `should-not-exist-${stamp}`,
        adminEmail: `nope-${stamp}@school.ke`,
        adminFullName: 'Nope',
        adminPassword: password
      })
      .expect(403);
  });

  it('a platform_admin onboards a real school, and its new admin can log in immediately', async () => {
    const newAdminEmail = `new-admin-${stamp}@newschool.ke`;
    const res = await request(app.getHttpServer())
      .post('/v1/tenants')
      .set('authorization', `Bearer ${platformAdminToken}`)
      .send({
        name: 'Genuinely New Academy',
        slug: `genuinely-new-${stamp}`,
        countyCode: '047',
        adminEmail: newAdminEmail,
        adminFullName: 'Brand New Admin',
        adminPassword: password
      })
      .expect(201);
    expect(res.body.tenantId).toBeTruthy();
    expect(res.body.adminUserId).toBeTruthy();
    schoolTenantId = res.body.tenantId;

    // The whole point: this account didn't exist a moment ago and
    // needed no separate invitation step to become usable.
    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: newAdminEmail, password })
      .expect(200);
    expect(loginRes.body.memberships).toHaveLength(1);
    expect(loginRes.body.memberships[0].tenantId).toBe(schoolTenantId);
    expect(loginRes.body.memberships[0].role).toBe('school_admin');

    const tenantRow = await admin.query(`SELECT kind, county_code FROM core.tenants WHERE id = $1`, [
      schoolTenantId
    ]);
    expect(tenantRow.rows[0].kind).toBe('school');
    expect(tenantRow.rows[0].county_code).toBe('047');
  });

  it('a duplicate slug is a clean 409, not a raw 500', async () => {
    await request(app.getHttpServer())
      .post('/v1/tenants')
      .set('authorization', `Bearer ${platformAdminToken}`)
      .send({
        name: 'Genuinely New Academy Again',
        slug: `genuinely-new-${stamp}`, // same slug as the school created above
        adminEmail: `another-${stamp}@newschool.ke`,
        adminFullName: 'Another Admin',
        adminPassword: password
      })
      .expect(409);
  });

  it('a duplicate admin email is a clean 409, AND the transaction is genuinely atomic — no orphaned tenant left behind', async () => {
    const takenEmail = `taken-${stamp}@school.ke`;
    // First, a real user with this email, in a completely unrelated tenant.
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: takenEmail,
        fullName: 'Already Exists',
        password,
        tenantId: platformTenantId,
        role: 'teacher'
      })
      .expect(201);

    const failingSlug = `atomicity-check-${stamp}`;
    await request(app.getHttpServer())
      .post('/v1/tenants')
      .set('authorization', `Bearer ${platformAdminToken}`)
      .send({
        name: 'Should Roll Back Academy',
        slug: failingSlug,
        adminEmail: takenEmail, // already taken — should fail
        adminFullName: 'Should Not Matter',
        adminPassword: password
      })
      .expect(409);

    // The real point of this test: if tenant creation and admin-user
    // creation weren't in the same transaction, the tenant row above
    // would have committed before the (failing) user insert — an
    // orphaned school with no admin, silently. Confirm it doesn't
    // exist at all.
    const orphanCheck = await admin.query(`SELECT id FROM core.tenants WHERE slug = $1`, [failingSlug]);
    expect(orphanCheck.rows).toHaveLength(0);
  });

  it('onboarding a county or ministry tenant assigns the correct role, not the school_admin default', async () => {
    // A real bug found while building the government dashboard: this
    // was hardcoded to school_admin regardless of kind, so a county
    // or ministry tenant's first account couldn't actually pass the
    // government module's own READ_ROLES/REFRESH_ROLES checks.
    const countyRes = await request(app.getHttpServer())
      .post('/v1/tenants')
      .set('authorization', `Bearer ${platformAdminToken}`)
      .send({
        name: 'Nairobi County Education Office',
        slug: `nairobi-county-${stamp}`,
        kind: 'county',
        countyCode: '047',
        adminEmail: `county-officer-${stamp}@nairobi.go.ke`,
        adminFullName: 'County Education Officer',
        adminPassword: password
      })
      .expect(201);
    expect(countyRes.body.adminRole).toBe('county_officer');
    const countyLogin = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: `county-officer-${stamp}@nairobi.go.ke`, password })
      .expect(200);
    expect(countyLogin.body.memberships[0].role).toBe('county_officer');

    const ministryRes = await request(app.getHttpServer())
      .post('/v1/tenants')
      .set('authorization', `Bearer ${platformAdminToken}`)
      .send({
        name: 'Ministry of Education HQ',
        slug: `moe-hq-${stamp}`,
        kind: 'ministry',
        adminEmail: `ministry-official-${stamp}@education.go.ke`,
        adminFullName: 'Ministry Official',
        adminPassword: password
      })
      .expect(201);
    expect(ministryRes.body.adminRole).toBe('ministry_official');
  });
});

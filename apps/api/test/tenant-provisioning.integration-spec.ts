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

  it('onboarding with gradeLevels + streams + academicYear creates a real class stream for every combination', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/tenants')
      .set('authorization', `Bearer ${platformAdminToken}`)
      .send({
        name: 'Bulk Class Academy',
        slug: `bulk-class-${stamp}`,
        adminEmail: `bulk-class-admin-${stamp}@newschool.ke`,
        adminFullName: 'Bulk Class Admin',
        adminPassword: password,
        academicYear: 2026,
        gradeLevels: ['G1', 'G2'],
        streams: ['A', 'B']
      })
      .expect(201);

    // Read via the app role with a bound context — FORCE RLS blocks
    // even the table-owner connection without app.tenant_id set,
    // same pattern as every other test file reading sis.* tables
    // directly.
    const appRead = new Client({ connectionString: appUrl });
    await appRead.connect();
    await appRead.query("SELECT set_config('app.tenant_id', $1, false)", [res.body.tenantId]);
    const classes = await appRead.query(
      `SELECT name, grade_level, academic_year FROM sis.class_streams WHERE tenant_id = $1 ORDER BY name`,
      [res.body.tenantId]
    );
    await appRead.end();

    // 2 grades x 2 streams = 4 real classes, not just accepted and
    // ignored — this is the actual feature, not just schema
    // acceptance.
    expect(classes.rows).toHaveLength(4);
    expect(classes.rows.map((r: { name: string }) => r.name)).toEqual(['G1 A', 'G1 B', 'G2 A', 'G2 B']);
    expect(classes.rows.every((r: { academic_year: number }) => r.academic_year === 2026)).toBe(true);
  });

  it('onboarding without gradeLevels/streams still works — both are optional, a school can add classes later instead', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/tenants')
      .set('authorization', `Bearer ${platformAdminToken}`)
      .send({
        name: 'No Classes Yet Academy',
        slug: `no-classes-yet-${stamp}`,
        adminEmail: `no-classes-admin-${stamp}@newschool.ke`,
        adminFullName: 'No Classes Admin',
        adminPassword: password
      })
      .expect(201);
    const appRead = new Client({ connectionString: appUrl });
    await appRead.connect();
    await appRead.query("SELECT set_config('app.tenant_id', $1, false)", [res.body.tenantId]);
    const classes = await appRead.query(`SELECT id FROM sis.class_streams WHERE tenant_id = $1`, [res.body.tenantId]);
    await appRead.end();
    expect(classes.rows).toHaveLength(0);
  });

  it('facilities/technology/finance/branding/institution/contacts/migration are all stored in tenants.settings — real record-keeping, not silently dropped', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/tenants')
      .set('authorization', `Bearer ${platformAdminToken}`)
      .send({
        name: 'Full Profile Academy',
        slug: `full-profile-${stamp}`,
        adminEmail: `full-profile-admin-${stamp}@newschool.ke`,
        adminFullName: 'Full Profile Admin',
        adminPassword: password,
        shortName: 'FPA',
        registrationNumber: 'REG-12345',
        educationLevel: 'Primary & Junior School',
        ownership: 'Private',
        yearEstablished: '2010',
        motto: 'Knowledge for all',
        subCounty: 'Westlands',
        ward: 'Parklands',
        physicalAddress: '123 Waiyaki Way',
        contacts: [
          { role: 'Principal / Headteacher', fullName: 'Jane Principal', phone: '0700000001', email: 'principal@fpa.ke', preferredChannel: 'EMAIL' },
          { role: 'Bursar', fullName: 'Bob Bursar', phone: '0700000002', preferredChannel: 'PHONE' }
        ],
        migrationMethod: 'IMPORT',
        migrationNotes: 'Migrating from a spreadsheet system.',
        facilities: ['Library', 'Computer Laboratory'],
        technology: { connectivityType: 'Fibre', hasElectricity: true, wifiCoverage: 'Full' },
        finance: { currency: 'KES', paymentMethods: ['M-Pesa'], mpesaNumber: '0700000000' },
        branding: { primaryColor: '#5B4CF5', secondaryColor: '#23286B' }
      })
      .expect(201);

    const tenantRow = await admin.query(`SELECT settings FROM core.tenants WHERE id = $1`, [res.body.tenantId]);
    const settings = tenantRow.rows[0].settings;
    expect(settings.institution).toEqual({
      shortName: 'FPA',
      registrationNumber: 'REG-12345',
      educationLevel: 'Primary & Junior School',
      ownership: 'Private',
      yearEstablished: '2010',
      motto: 'Knowledge for all'
    });
    expect(settings.contacts).toHaveLength(2);
    expect(settings.contacts[0]).toEqual({
      role: 'Principal / Headteacher',
      fullName: 'Jane Principal',
      phone: '0700000001',
      email: 'principal@fpa.ke',
      preferredChannel: 'EMAIL'
    });
    expect(settings.migration).toEqual({ method: 'IMPORT', notes: 'Migrating from a spreadsheet system.' });
    expect(settings.location).toEqual({ subCounty: 'Westlands', ward: 'Parklands', physicalAddress: '123 Waiyaki Way' });
    expect(settings.facilities).toEqual(['Library', 'Computer Laboratory']);
    expect(settings.technology.connectivityType).toBe('Fibre');
    expect(settings.finance.mpesaNumber).toBe('0700000000');
    expect(settings.branding.primaryColor).toBe('#5B4CF5');
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

  it('GET /tenants/current returns the caller\'s own tenant with a null logo by default', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/tenants/current')
      .set('authorization', `Bearer ${platformAdminToken}`)
      .expect(200);
    expect(res.body.logoDataUrl).toBeNull();
    expect(res.body.name).toBeTruthy();
  });

  it('PATCH /tenants/logo updates the logo, and GET /tenants/current reflects it back', async () => {
    // A tiny (deliberately minimal) valid PNG data URL, not a
    // realistic logo -- what matters for this test is that a
    // well-formed image data URL round-trips correctly, not the
    // actual pixel content.
    const tinyPngDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

    await request(app.getHttpServer())
      .patch('/v1/tenants/logo')
      .set('authorization', `Bearer ${platformAdminToken}`)
      .send({ logoDataUrl: tinyPngDataUrl })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/v1/tenants/current')
      .set('authorization', `Bearer ${platformAdminToken}`)
      .expect(200);
    expect(res.body.logoDataUrl).toBe(tinyPngDataUrl);
  });

  it('PATCH /tenants/logo rejects a non-image data URL with a clean 400, not a raw crash', async () => {
    await request(app.getHttpServer())
      .patch('/v1/tenants/logo')
      .set('authorization', `Bearer ${platformAdminToken}`)
      .send({ logoDataUrl: 'not-a-data-url-at-all' })
      .expect(400);
  });

  it('PATCH /tenants/logo is forbidden for a teacher — logo changes are admin-only', async () => {
    const teacherRes = await request(app.getHttpServer())
      .post('/v1/tenants')
      .set('authorization', `Bearer ${platformAdminToken}`)
      .send({
        name: 'Logo Permission Test School',
        slug: `logo-perm-${stamp}`,
        adminEmail: `logo-perm-admin-${stamp}@newschool.ke`,
        adminFullName: 'Logo Perm Admin',
        adminPassword: password
      })
      .expect(201);
    const adminToken = (
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: `logo-perm-admin-${stamp}@newschool.ke`, password })
        .expect(200)
    ).body.tokens.accessToken;

    const teacherEmail = `logo-perm-teacher-${stamp}@newschool.ke`;
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: teacherEmail,
        fullName: 'Logo Perm Teacher',
        password,
        tenantId: teacherRes.body.tenantId,
        role: 'teacher'
      })
      .expect(201);
    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: teacherEmail, password })
      .expect(200);

    await request(app.getHttpServer())
      .patch('/v1/tenants/logo')
      .set('authorization', `Bearer ${loginRes.body.tokens.accessToken}`)
      .send({
        logoDataUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
      })
      .expect(403);
    // adminToken isn't otherwise used in this test, but confirms the
    // school admin login itself succeeded, which the teacher path
    // depends on for tenant context.
    expect(adminToken).toBeTruthy();
  });
});

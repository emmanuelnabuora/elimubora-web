import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { APP_CONFIG, type AppConfig } from '../src/config/configuration';

const appUrl = process.env.INTEGRATION_DATABASE_URL;
const adminUrl = process.env.INTEGRATION_ADMIN_DATABASE_URL ?? appUrl;
const d = appUrl ? describe : describe.skip;

d('Government Dashboard (integration)', () => {
  let app: INestApplication;
  let db: Client;
  let schoolATenant: string;
  let countyTenant: string;
  let countyBTenant: string;
  let ministryTenant: string;

  const stamp = Date.now();
  const password = 'A-genuinely-long-password-1';
  const year = 2026;
  // Unique-per-run county codes — the national rollup is genuinely
  // global (every school tenant ever created in this shared test
  // database contributes), so county-scoped assertions must use
  // codes that cannot collide with any other test run's data.
  const countyA = `A${stamp.toString().slice(-6)}`;
  const countyB = `B${stamp.toString().slice(-6)}`;

  let countyOfficerToken: string;
  let countyBOfficerToken: string;
  let ministryToken: string;
  let schoolAdminToken: string;

  const config: AppConfig = {
    nodeEnv: 'test',
    port: 0,
    databaseUrl: appUrl as string,
    workerDatabaseUrl: 'postgres://elimubora_worker:worker_dev_password@localhost:5432/elimubora',
    outboxPollMs: 60_000,
    syncVisibilityDelaySeconds: 0,
    publicWebUrl: 'http://localhost:3000',
  uploadsDir: './uploads-test',
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

    const tenants = await db.query(
      `INSERT INTO core.tenants (slug, name, kind, county_code) VALUES
         ($1, 'Gov School A', 'school', $6),
         ($2, 'Gov School B', 'school', $7),
         ($3, 'Nairobi County Office', 'county', $6),
         ($4, 'Kiambu County Office', 'county', $7),
         ($5, 'Ministry HQ', 'ministry', NULL)
       RETURNING id`,
      [
        `gov-school-a-${stamp}`,
        `gov-school-b-${stamp}`,
        `gov-county-a-${stamp}`,
        `gov-county-b-${stamp}`,
        `gov-ministry-${stamp}`,
        countyA,
        countyB
      ]
    );
    schoolATenant = tenants.rows[0].id;
    countyTenant = tenants.rows[2].id;
    countyBTenant = tenants.rows[3].id;
    ministryTenant = tenants.rows[4].id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(config)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1', { exclude: ['health'] });
    await app.init();

    // School A: admin + a class with 2 active students + attendance.
    const schoolAAdminEmail = `gov-a-admin-${stamp}@school.ke`;
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: schoolAAdminEmail,
        fullName: 'Gov A Admin',
        password,
        tenantId: schoolATenant,
        role: 'school_admin'
      })
      .expect(201);
    schoolAdminToken = await login(schoolAAdminEmail);

    const teacherEmail = `gov-a-teacher-${stamp}@school.ke`;
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email: teacherEmail, fullName: 'Gov A Teacher', password, tenantId: schoolATenant, role: 'teacher' })
      .expect(201);
    const teacherToken = await login(teacherEmail);

    const stream = await request(app.getHttpServer())
      .post('/v1/class-streams')
      .set('authorization', `Bearer ${schoolAdminToken}`)
      .send({ name: 'Grade 4 Gov', gradeLevel: 'G4', academicYear: year })
      .expect(201);

    for (let i = 0; i < 2; i += 1) {
      const learner = await request(app.getHttpServer())
        .post('/v1/students')
        .set('authorization', `Bearer ${schoolAdminToken}`)
        .send({
          fullName: `Gov Learner ${i}`,
          gradeLevel: 'G4',
          classStreamId: stream.body.id,
          academicYear: year
        })
        .expect(201);
      await request(app.getHttpServer())
        .post('/v1/attendance')
        .set('authorization', `Bearer ${teacherToken}`)
        .send({
          classStreamId: stream.body.id,
          learnerId: learner.body.studentId,
          attendanceDate: `${year}-03-01`,
          status: i === 0 ? 'present' : 'absent'
        })
        .expect(201);
    }

    // County officer accounts.
    const countyOfficerEmail = `gov-county-a-officer-${stamp}@county.ke`;
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: countyOfficerEmail,
        fullName: 'County A Officer',
        password,
        tenantId: countyTenant,
        role: 'county_officer'
      })
      .expect(201);
    countyOfficerToken = await login(countyOfficerEmail);

    const countyBOfficerEmail = `gov-county-b-officer-${stamp}@county.ke`;
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: countyBOfficerEmail,
        fullName: 'County B Officer',
        password,
        tenantId: countyBTenant,
        role: 'county_officer'
      })
      .expect(201);
    countyBOfficerToken = await login(countyBOfficerEmail);

    const ministryEmail = `gov-ministry-official-${stamp}@ministry.ke`;
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: ministryEmail,
        fullName: 'Ministry Official',
        password,
        tenantId: ministryTenant,
        role: 'ministry_official'
      })
      .expect(201);
    ministryToken = await login(ministryEmail);
  });

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it('a school admin cannot access the government dashboard at all', async () => {
    await request(app.getHttpServer())
      .get('/v1/gov/enrollment')
      .query({ academicYear: year })
      .set('authorization', `Bearer ${schoolAdminToken}`)
      .expect(403);
  });

  it('a county officer cannot trigger a national refresh (ministry-only action)', async () => {
    await request(app.getHttpServer())
      .post('/v1/gov/enrollment/refresh')
      .set('authorization', `Bearer ${countyOfficerToken}`)
      .send({ academicYear: year })
      .expect(403);
  });

  it('the app role cannot write a snapshot directly — only the refresh (worker-role) path can', async () => {
    const appClient = new Client({ connectionString: appUrl });
    await appClient.connect();
    let errorCode: string | undefined;
    try {
      await appClient.query(
        `INSERT INTO gov.enrollment_snapshots (county_code, academic_year, total_students, total_schools)
         VALUES ('999', 2099, 999999, 1)`
      );
    } catch (e) {
      errorCode = (e as { code?: string }).code;
    }
    await appClient.end();
    expect(errorCode).toBe('42501'); // insufficient_privilege
  });

  it('ministry official refreshes national enrollment and attendance rollups', async () => {
    await request(app.getHttpServer())
      .post('/v1/gov/enrollment/refresh')
      .set('authorization', `Bearer ${ministryToken}`)
      .send({ academicYear: year })
      .expect(201);
    await request(app.getHttpServer())
      .post('/v1/gov/attendance/refresh')
      .set('authorization', `Bearer ${ministryToken}`)
      .send({ academicYear: year })
      .expect(201);
  });

  it('THE COUNTY SCOPE GATE: a county officer always sees their own county regardless of what they ask for', async () => {
    const own = await request(app.getHttpServer())
      .get('/v1/gov/enrollment')
      .query({ academicYear: year })
      .set('authorization', `Bearer ${countyOfficerToken}`)
      .expect(200);
    expect(own.body.countyCode).toBe(countyA);
    expect(own.body.totalStudents).toBe(2);
    expect(own.body.totalSchools).toBe(1);

    // Even asking explicitly for a different county in the query
    // string, the server ignores it and returns their own county.
    const attempted = await request(app.getHttpServer())
      .get('/v1/gov/enrollment')
      .query({ academicYear: year, countyCode: countyB })
      .set('authorization', `Bearer ${countyOfficerToken}`)
      .expect(200);
    expect(attempted.body.countyCode).toBe(countyA);

    // County B's school exists but has zero enrolled students — the
    // LEFT JOIN still produces a real snapshot row for it (0 students,
    // 1 school), which is correct: "no data yet" and "county has no
    // schools at all" are different, distinguishable facts.
    const countyBResult = await request(app.getHttpServer())
      .get('/v1/gov/enrollment')
      .query({ academicYear: year })
      .set('authorization', `Bearer ${countyBOfficerToken}`)
      .expect(200);
    expect(countyBResult.body).toMatchObject({
      countyCode: countyB,
      totalStudents: 0,
      totalSchools: 1
    });
  });

  it('a ministry official can request national (no county) or any specific county', async () => {
    const national = await request(app.getHttpServer())
      .get('/v1/gov/enrollment')
      .query({ academicYear: year })
      .set('authorization', `Bearer ${ministryToken}`)
      .expect(200);
    expect(national.body.countyCode).toBeNull();
    expect(national.body.totalStudents).toBeGreaterThanOrEqual(2);
    expect(national.body.totalSchools).toBeGreaterThanOrEqual(1);

    const specific = await request(app.getHttpServer())
      .get('/v1/gov/enrollment')
      .query({ academicYear: year, countyCode: countyA })
      .set('authorization', `Bearer ${ministryToken}`)
      .expect(200);
    expect(specific.body.countyCode).toBe(countyA);
  });

  it('attendance rollup reflects a 50% present/late rate (1 present, 1 absent)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/gov/attendance')
      .query({ academicYear: year })
      .set('authorization', `Bearer ${countyOfficerToken}`)
      .expect(200);
    expect(res.body.averageAttendanceRate).toBe('50.00');
  });

  it('the national by-county breakdown is restricted to ministry roles, not county officers', async () => {
    await request(app.getHttpServer())
      .get('/v1/gov/enrollment/by-county')
      .query({ academicYear: year })
      .set('authorization', `Bearer ${countyOfficerToken}`)
      .expect(403);

    const res = await request(app.getHttpServer())
      .get('/v1/gov/enrollment/by-county')
      .query({ academicYear: year })
      .set('authorization', `Bearer ${ministryToken}`)
      .expect(200);
    const countyRow = res.body.find((c: { countyCode: string }) => c.countyCode === countyA);
    expect(countyRow).toBeDefined();
    expect(countyRow.totalStudents).toBe(2);
  });
});

import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { APP_CONFIG, type AppConfig } from '../src/config/configuration';

const appUrl = process.env.INTEGRATION_DATABASE_URL;
const adminUrl = process.env.INTEGRATION_ADMIN_DATABASE_URL ?? appUrl;
const d = appUrl ? describe : describe.skip;

d('Guardian invitations (integration)', () => {
  let app: INestApplication;
  let db: Client;
  let tenantId: string;
  let otherTenantId: string;

  const stamp = Date.now();
  const password = 'A-genuinely-long-password-1';
  const adminEmail = `gi-admin-${stamp}@school.ke`;
  const teacherEmail = `gi-teacher-${stamp}@school.ke`;
  const otherAdminEmail = `gi-other-admin-${stamp}@school.ke`;
  const parentEmail = `gi-parent-${stamp}@school.ke`;

  let adminToken: string;
  let teacherToken: string;
  let otherAdminToken: string;
  let classStreamId: string;
  let childAId: string;
  let childBId: string;

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

  const extractToken = (acceptUrl: string) => new URL(acceptUrl).searchParams.get('token')!;

  beforeAll(async () => {
    db = new Client({ connectionString: adminUrl });
    await db.connect();
    const t = await db.query(
      `INSERT INTO core.tenants (slug, name, kind) VALUES
         ($1, 'Guardian Invitation School', 'school'), ($2, 'Guardian Invitation Other School', 'school')
       RETURNING id`,
      [`gi-school-${stamp}`, `gi-other-school-${stamp}`]
    );
    tenantId = t.rows[0].id;
    otherTenantId = t.rows[1].id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(config)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1', { exclude: ['health'] });
    await app.init();

    for (const [email, role, tid] of [
      [adminEmail, 'school_admin', tenantId],
      [teacherEmail, 'teacher', tenantId],
      [otherAdminEmail, 'school_admin', otherTenantId],
      [parentEmail, 'parent', tenantId]
    ] as const) {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email, fullName: 'Guardian Invitation Test Person', password, tenantId: tid, role })
        .expect(201);
    }
    adminToken = await login(adminEmail);
    teacherToken = await login(teacherEmail);
    otherAdminToken = await login(otherAdminEmail);

    const stream = await request(app.getHttpServer())
      .post('/v1/class-streams')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ name: 'GI Grade 4', gradeLevel: 'G4', academicYear: 2026 })
      .expect(201);
    classStreamId = stream.body.id;

    const childA = await request(app.getHttpServer())
      .post('/v1/students')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'Child A', gradeLevel: 'G4', classStreamId, academicYear: 2026 })
      .expect(201);
    childAId = childA.body.studentId;

    const childB = await request(app.getHttpServer())
      .post('/v1/students')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'Child B', gradeLevel: 'G4', classStreamId, academicYear: 2026 })
      .expect(201);
    childBId = childB.body.studentId;
  });

  afterAll(async () => {
    await app.close();
    await db.end();
  });

  it('a teacher (non-admin staff) cannot invite a guardian', async () => {
    await request(app.getHttpServer())
      .post(`/v1/students/${childAId}/guardian-invitations`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ email: parentEmail, relationship: 'mother' })
      .expect(403);
  });

  it('an admin at a different school cannot invite a guardian for a student that is not theirs', async () => {
    await request(app.getHttpServer())
      .post(`/v1/students/${childAId}/guardian-invitations`)
      .set('authorization', `Bearer ${otherAdminToken}`)
      .send({ email: parentEmail, relationship: 'mother' })
      .expect(403);
  });

  it('inviting with custom permissions and emergency-contact, then accepting, persists both onto the real relationship', async () => {
    const invited = await request(app.getHttpServer())
      .post(`/v1/students/${childAId}/guardian-invitations`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        email: parentEmail,
        relationship: 'mother',
        isPrimary: true,
        canPickup: true,
        isEmergencyContact: true,
        permissions: { view_finance: false, pay_fees: false }
      })
      .expect(201);
    expect(invited.body.acceptUrl).toBeDefined();

    const accepted = await request(app.getHttpServer())
      .post('/v1/guardian-invitations/accept')
      .send({ token: extractToken(invited.body.acceptUrl), fullName: 'Guardian One', password })
      .expect(201);
    expect(accepted.body.studentId).toBe(childAId);

    const parentToken = await login(parentEmail);
    const children = await request(app.getHttpServer())
      .get('/v1/parent-portal/children')
      .set('authorization', `Bearer ${parentToken}`)
      .expect(200);
    expect(children.body.some((c: { studentId: string }) => c.studentId === childAId)).toBe(true);

    // The database-owner connection needs FORCE RLS temporarily
    // lifted to read this directly, since sis.student_guardians (like
    // most tenant-scoped tables in this schema) forces RLS even for
    // the table owner without an explicit policy for that role.
    await db.query(`ALTER TABLE sis.student_guardians NO FORCE ROW LEVEL SECURITY`);
    try {
      const link = await db.query(
        `SELECT is_emergency_contact, permissions FROM sis.student_guardians
          WHERE tenant_id = $1 AND student_id = $2`,
        [tenantId, childAId]
      );
      expect(link.rows).toHaveLength(1);
      expect(link.rows[0].is_emergency_contact).toBe(true);
      expect(link.rows[0].permissions.view_finance).toBe(false);
      expect(link.rows[0].permissions.pay_fees).toBe(false);
      // Permissions not explicitly overridden keep their defaults.
      expect(link.rows[0].permissions.view_academics).toBe(true);
    } finally {
      await db.query(`ALTER TABLE sis.student_guardians FORCE ROW LEVEL SECURITY`);
    }
  });

  it('inviting the same, now-existing guardian for a second child links both children to one guardian record, not two duplicates', async () => {
    const invited = await request(app.getHttpServer())
      .post(`/v1/students/${childBId}/guardian-invitations`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ email: parentEmail, relationship: 'mother', isPrimary: true })
      .expect(201);

    // No fullName/password needed this time — the account already exists.
    const accepted = await request(app.getHttpServer())
      .post('/v1/guardian-invitations/accept')
      .send({ token: extractToken(invited.body.acceptUrl) })
      .expect(201);
    expect(accepted.body.createdUser).toBe(false);
    expect(accepted.body.studentId).toBe(childBId);

    const parentToken = await login(parentEmail);
    const children = await request(app.getHttpServer())
      .get('/v1/parent-portal/children')
      .set('authorization', `Bearer ${parentToken}`)
      .expect(200);
    const studentIds = children.body.map((c: { studentId: string }) => c.studentId);
    expect(studentIds).toContain(childAId);
    expect(studentIds).toContain(childBId);

    await db.query(`ALTER TABLE sis.guardians NO FORCE ROW LEVEL SECURITY`);
    try {
      const guardianRows = await db.query(
        `SELECT count(*)::int AS n FROM sis.guardians WHERE tenant_id = $1 AND email = $2 AND deleted_at IS NULL`,
        [tenantId, parentEmail]
      );
      expect(guardianRows.rows[0].n).toBe(1);
    } finally {
      await db.query(`ALTER TABLE sis.guardians FORCE ROW LEVEL SECURITY`);
    }
  });

  it('resending a pending invitation issues a new, working token and invalidates the old one', async () => {
    const secondParentEmail = `gi-parent2-${stamp}@school.ke`;
    const invited = await request(app.getHttpServer())
      .post(`/v1/students/${childAId}/guardian-invitations`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ email: secondParentEmail, relationship: 'father' })
      .expect(201);
    const originalToken = extractToken(invited.body.acceptUrl);

    const resent = await request(app.getHttpServer())
      .patch(`/v1/users/invitations/${invited.body.id}/resend`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const newToken = extractToken(resent.body.acceptUrl);
    expect(newToken).not.toBe(originalToken);

    // The old token no longer works.
    await request(app.getHttpServer())
      .post('/v1/guardian-invitations/accept')
      .send({ token: originalToken, fullName: 'Guardian Two', password })
      .expect(400);

    // The new one does.
    await request(app.getHttpServer())
      .post('/v1/guardian-invitations/accept')
      .send({ token: newToken, fullName: 'Guardian Two', password })
      .expect(201);
  });

  it('declining an invitation makes it permanently unusable, without creating any account', async () => {
    const thirdParentEmail = `gi-parent3-${stamp}@school.ke`;
    const invited = await request(app.getHttpServer())
      .post(`/v1/students/${childAId}/guardian-invitations`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ email: thirdParentEmail, relationship: 'guardian' })
      .expect(201);
    const token = extractToken(invited.body.acceptUrl);

    await request(app.getHttpServer()).post('/v1/guardian-invitations/decline').send({ token }).expect(201);

    await request(app.getHttpServer())
      .post('/v1/guardian-invitations/accept')
      .send({ token, fullName: 'Should Not Work', password })
      .expect(400);

    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: thirdParentEmail, password })
      .expect(401);
    expect(login.body).toBeDefined();
  });
});

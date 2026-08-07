import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request from 'supertest';
import argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { APP_CONFIG, type AppConfig } from '../src/config/configuration';

const appUrl = process.env.INTEGRATION_DATABASE_URL;
const adminUrl = process.env.INTEGRATION_ADMIN_DATABASE_URL ?? appUrl;
const d = appUrl ? describe : describe.skip;

d('Student Information System (integration)', () => {
  let app: INestApplication;
  let db: Client;
  let tenantA: string;
  let tenantB: string;

  const stamp = Date.now();
  const password = 'A-genuinely-long-password-1';
  const adminAEmail = `sis-admin-a-${stamp}@school.ke`;
  const adminBEmail = `sis-admin-b-${stamp}@school.ke`;
  const teacherEmail = `sis-teacher-${stamp}@school.ke`;

  let adminAToken: string;
  let adminBToken: string;
  let teacherToken: string;
  let classStreamId: string;
  let studentId: string;
  let transferId: string;

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
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.tokens.accessToken as string;
  };

  beforeAll(async () => {
    db = new Client({ connectionString: adminUrl });
    await db.connect();
    const t = await db.query(
      `INSERT INTO core.tenants (slug, name, kind) VALUES
         ($1, 'SIS School A', 'school'), ($2, 'SIS School B', 'school')
       RETURNING id`,
      [`sis-a-${stamp}`, `sis-b-${stamp}`]
    );
    tenantA = t.rows[0].id;
    tenantB = t.rows[1].id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(config)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1', { exclude: ['health'] });
    await app.init();

    for (const [email, tenantId, role] of [
      [adminAEmail, tenantA, 'school_admin'],
      [adminBEmail, tenantB, 'school_admin'],
      [teacherEmail, tenantA, 'teacher']
    ] as const) {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email, fullName: 'SIS Staff', password, tenantId, role })
        .expect(201);
    }
    adminAToken = await login(adminAEmail);
    adminBToken = await login(adminBEmail);
    teacherToken = await login(teacherEmail);

    const stream = await request(app.getHttpServer())
      .post('/v1/class-streams')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Grade 4 Blue', gradeLevel: 'G4', academicYear: 2026 })
      .expect(201);
    classStreamId = stream.body.id;
  });

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it('a teacher cannot enroll a student (admin-only orchestration)', async () => {
    await request(app.getHttpServer())
      .post('/v1/students')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({
        fullName: 'Wanjiru Kamau',
        gradeLevel: 'G4',
        classStreamId,
        academicYear: 2026
      })
      .expect(403);
  });

  it('enrolling a student provisions a real system identity and allocates a class, with real address/emergency contact fields', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/students')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({
        fullName: 'Wanjiru Kamau',
        dateOfBirth: '2017-03-14',
        gender: 'female',
        address: '789 Uhuru Highway, Nairobi',
        emergencyContactName: 'Peter Kamau',
        emergencyContactPhone: '+254700111222',
        gradeLevel: 'G4',
        classStreamId,
        academicYear: 2026
      })
      .expect(201);
    studentId = res.body.studentId;
    expect(res.body.status).toBe('active');
    expect(res.body.admissionNumber).toMatch(/^2026-[0-9A-F]{6}$/);
    expect(res.body.address).toBe('789 Uhuru Highway, Nairobi');
    expect(res.body.emergencyContactName).toBe('Peter Kamau');
    expect(res.body.emergencyContactPhone).toBe('+254700111222');

    // Also readable back via the real single-student lookup, not just
    // in the immediate creation response.
    const fetched = await request(app.getHttpServer())
      .get(`/v1/students/${studentId}`)
      .set('authorization', `Bearer ${adminAToken}`)
      .expect(200);
    expect(fetched.body).toMatchObject({
      address: '789 Uhuru Highway, Nairobi',
      emergencyContactName: 'Peter Kamau',
      emergencyContactPhone: '+254700111222'
    });

    // The provisioned identity is a real core.users row with a membership.
    // Read via the app role with a bound context — FORCE RLS blocks even
    // the table-owner connection (the recurring lesson from ADR-006/007).
    const appRead = new Client({ connectionString: appUrl });
    await appRead.connect();
    await appRead.query("SELECT set_config('app.tenant_id', $1, false)", [tenantA]);
    const { rows } = await appRead.query(
      `SELECT role FROM core.memberships WHERE user_id = $1 AND tenant_id = core.current_tenant_id()`,
      [studentId]
    );
    await appRead.end();
    expect(rows).toEqual([{ role: 'learner' }]);

    const roster = await request(app.getHttpServer())
      .get(`/v1/class-streams/${classStreamId}/roster`)
      .set('authorization', `Bearer ${adminAToken}`)
      .expect(200);
    expect(roster.body).toEqual([
      expect.objectContaining({ studentId, admissionNumber: res.body.admissionNumber })
    ]);
  });

  it('medical records are restricted to administrative roles, not teachers', async () => {
    await request(app.getHttpServer())
      .patch(`/v1/students/${studentId}/medical`)
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ bloodGroup: 'O+', allergies: 'Penicillin' })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/v1/students/${studentId}/medical`)
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(403);

    const asAdmin = await request(app.getHttpServer())
      .get(`/v1/students/${studentId}/medical`)
      .set('authorization', `Bearer ${adminAToken}`)
      .expect(200);
    expect(asAdmin.body).toMatchObject({ bloodGroup: 'O+', allergies: 'Penicillin' });
  });

  it('a guardian can be linked and retrieved, including the real physical address field', async () => {
    const guardian = await request(app.getHttpServer())
      .post('/v1/guardians')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ fullName: 'Mary Kamau', phone: '+254712345678', physicalAddress: '123 Moi Avenue, Nairobi' })
      .expect(201);
    expect(guardian.body.physicalAddress).toBe('123 Moi Avenue, Nairobi');

    const linked = await request(app.getHttpServer())
      .post(`/v1/students/${studentId}/guardians`)
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ guardianId: guardian.body.id, relationship: 'mother', isPrimary: true })
      .expect(201);
    expect(linked.body).toEqual([
      expect.objectContaining({ fullName: 'Mary Kamau', userId: null, physicalAddress: '123 Moi Avenue, Nairobi' })
    ]);
  });

  it('a school cannot transfer a student to itself', async () => {
    await request(app.getHttpServer())
      .post(`/v1/students/${studentId}/transfers`)
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ toTenantId: tenantA })
      .expect(400);
  });

  it('requests a cross-tenant transfer, visible to both schools via RLS', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/students/${studentId}/transfers`)
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ toTenantId: tenantB, reason: 'Family relocation' })
      .expect(201);
    transferId = res.body.id;
    expect(res.body.status).toBe('pending');

    // Both the sending and receiving admin can see it — the two-sided
    // RLS policy, not a single tenant_id column.
    await request(app.getHttpServer())
      .get(`/v1/transfers/${transferId}`)
      .set('authorization', `Bearer ${adminAToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/v1/transfers/${transferId}`)
      .set('authorization', `Bearer ${adminBToken}`)
      .expect(200);
  });

  it('only the RECEIVING school can decide the transfer — the sender cannot self-approve', async () => {
    await request(app.getHttpServer())
      .patch(`/v1/transfers/${transferId}/decision`)
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ status: 'accepted' })
      .expect(403);

    const decided = await request(app.getHttpServer())
      .patch(`/v1/transfers/${transferId}/decision`)
      .set('authorization', `Bearer ${adminBToken}`)
      .send({ status: 'accepted' })
      .expect(200);
    expect(decided.body.status).toBe('accepted');

    // A decided transfer cannot be decided again.
    await request(app.getHttpServer())
      .patch(`/v1/transfers/${transferId}/decision`)
      .set('authorization', `Bearer ${adminBToken}`)
      .send({ status: 'rejected' })
      .expect(400);
  });

  it('accepting the transfer marks the source profile transferred_out', async () => {
    const appRead = new Client({ connectionString: appUrl });
    await appRead.connect();
    await appRead.query("SELECT set_config('app.tenant_id', $1, false)", [tenantA]);
    const { rows } = await appRead.query(
      `SELECT status FROM sis.student_profiles WHERE student_id = $1 AND tenant_id = core.current_tenant_id()`,
      [studentId]
    );
    await appRead.end();
    expect(rows[0].status).toBe('transferred_out');
  });

  it('a school outside both sides of the transfer cannot see it', async () => {
    const t3 = await db.query(
      `INSERT INTO core.tenants (slug, name, kind) VALUES ($1, 'SIS School C', 'school') RETURNING id`,
      [`sis-c-${stamp}`]
    );
    const cEmail = `sis-admin-c-${stamp}@school.ke`;
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email: cEmail, fullName: 'C Admin', password, tenantId: t3.rows[0].id, role: 'school_admin' })
      .expect(201);
    const cToken = await login(cEmail);
    await request(app.getHttpServer())
      .get(`/v1/transfers/${transferId}`)
      .set('authorization', `Bearer ${cToken}`)
      .expect(404);
  });

  it('graduating a student updates status and is admin-only', async () => {
    // Enroll a fresh student in school B to graduate (the original was transferred, not graduated).
    const streamB = await request(app.getHttpServer())
      .post('/v1/class-streams')
      .set('authorization', `Bearer ${adminBToken}`)
      .send({ name: 'Grade 8 Green', gradeLevel: 'G8', academicYear: 2026 })
      .expect(201);
    const grad = await request(app.getHttpServer())
      .post('/v1/students')
      .set('authorization', `Bearer ${adminBToken}`)
      .send({ fullName: 'Otieno Omondi', gradeLevel: 'G8', classStreamId: streamB.body.id, academicYear: 2026 })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/students/${grad.body.studentId}/graduate`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ cohortYear: 2026 })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/v1/students/${grad.body.studentId}/graduate`)
      .set('authorization', `Bearer ${adminBToken}`)
      .send({ cohortYear: 2026 })
      .expect(201);

    const profile = await request(app.getHttpServer())
      .get(`/v1/students/${grad.body.studentId}`)
      .set('authorization', `Bearer ${adminBToken}`)
      .expect(200);
    expect(profile.body.status).toBe('graduated');
  });

  it('GET /class-streams lists tenant-scoped class streams, staff-only (teacher and admin)', async () => {
    // Teachers need this list too -- to pick a class when marking
    // attendance, for instance -- so this is deliberately staff-wide,
    // not admin-only.
    const asTeacher = await request(app.getHttpServer())
      .get('/v1/class-streams')
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(200);
    expect(asTeacher.body.find((s: { id: string }) => s.id === classStreamId)).toBeDefined();

    const res = await request(app.getHttpServer())
      .get('/v1/class-streams')
      .set('authorization', `Bearer ${adminAToken}`)
      .expect(200);
    const stream = res.body.find((s: { id: string }) => s.id === classStreamId);
    expect(stream).toMatchObject({ name: 'Grade 4 Blue', gradeLevel: 'G4' });
  });

  it('GET /students lists tenant-scoped students with name and current class, staff-only (teacher and admin)', async () => {
    // A dedicated, freshly-enrolled student — not the shared studentId
    // fixture, whose status/class allocation earlier tests in this
    // file have already mutated (transferred out) by this point.
    const dedicatedStream = await request(app.getHttpServer())
      .post('/v1/class-streams')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Grade 5 Listing Test', gradeLevel: 'G5', academicYear: 2026 })
      .expect(201);
    const dedicatedStudent = await request(app.getHttpServer())
      .post('/v1/students')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({
        fullName: 'Listing Test Student',
        gradeLevel: 'G5',
        classStreamId: dedicatedStream.body.id,
        academicYear: 2026
      })
      .expect(201);

    const asTeacher = await request(app.getHttpServer())
      .get('/v1/students')
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(200);
    expect(
      asTeacher.body.find((s: { studentId: string }) => s.studentId === dedicatedStudent.body.studentId)
    ).toBeDefined();

    const res = await request(app.getHttpServer())
      .get('/v1/students')
      .set('authorization', `Bearer ${adminAToken}`)
      .expect(200);
    const student = res.body.find(
      (s: { studentId: string }) => s.studentId === dedicatedStudent.body.studentId
    );
    expect(student).toBeDefined();
    expect(student.fullName).toBe('Listing Test Student');
    expect(student.className).toBe('Grade 5 Listing Test');
    expect(student.gradeLevel).toBe('G5');
    expect(student.status).toBe('active');

    // Tenant B's admin sees none of tenant A's students — real RLS isolation, not just a filter.
    const resB = await request(app.getHttpServer())
      .get('/v1/students')
      .set('authorization', `Bearer ${adminBToken}`)
      .expect(200);
    expect(
      resB.body.find((s: { studentId: string }) => s.studentId === dedicatedStudent.body.studentId)
    ).toBeUndefined();
  });

  it('submits an admission application, admin-only', async () => {
    await request(app.getHttpServer())
      .post('/v1/admissions')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({
        candidateName: 'Kevin Otieno',
        guardianName: 'Mary Otieno',
        guardianPhone: '0712345678',
        gradeLevelApplied: 'G3'
      })
      .expect(403);

    const res = await request(app.getHttpServer())
      .post('/v1/admissions')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({
        candidateName: 'Kevin Otieno',
        guardianName: 'Mary Otieno',
        guardianPhone: '0712345678',
        gradeLevelApplied: 'G3'
      })
      .expect(201);
    expect(res.body.status).toBe('submitted');
  });

  it('GET /admissions lists tenant-scoped applications, admin-only, and a decision updates status', async () => {
    const app1 = await request(app.getHttpServer())
      .post('/v1/admissions')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({
        candidateName: 'Listing Test Candidate',
        guardianName: 'Guardian Name',
        guardianPhone: '0700000000',
        gradeLevelApplied: 'G2'
      })
      .expect(201);

    await request(app.getHttpServer())
      .get('/v1/admissions')
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(403);

    const listed = await request(app.getHttpServer())
      .get('/v1/admissions')
      .set('authorization', `Bearer ${adminAToken}`)
      .expect(200);
    const found = listed.body.find((a: { id: string }) => a.id === app1.body.id);
    expect(found).toBeDefined();
    expect(found.status).toBe('submitted');

    // Tenant B's admin sees none of tenant A's applications — real RLS isolation.
    const listedB = await request(app.getHttpServer())
      .get('/v1/admissions')
      .set('authorization', `Bearer ${adminBToken}`)
      .expect(200);
    expect(listedB.body.find((a: { id: string }) => a.id === app1.body.id)).toBeUndefined();

    await request(app.getHttpServer())
      .patch(`/v1/admissions/${app1.body.id}/decision`)
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ status: 'admitted', notes: 'Strong interview' })
      .expect(200);

    const afterDecision = await request(app.getHttpServer())
      .get('/v1/admissions')
      .set('authorization', `Bearer ${adminAToken}`)
      .expect(200);
    const decided = afterDecision.body.find((a: { id: string }) => a.id === app1.body.id);
    expect(decided.status).toBe('admitted');
    expect(decided.notes).toBe('Strong interview');
    expect(decided.studentId).toBeNull();
  });

  it('enrolling a student from an already-admitted application links the two, closing the admissions loop', async () => {
    const application = await request(app.getHttpServer())
      .post('/v1/admissions')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({
        candidateName: 'Enroll Loop Candidate',
        guardianName: 'Enroll Loop Guardian',
        guardianPhone: '0700111222',
        gradeLevelApplied: 'G9'
      })
      .expect(201);

    // Admitted first, as a standalone decision, exactly like an admin
    // clicking "Admit" on the Admissions page before ever enrolling
    // anyone -- decideApplication's own WHERE clause (submitted/
    // under_review only) means the application is no longer
    // "decidable" by the time enrollment happens next.
    await request(app.getHttpServer())
      .patch(`/v1/admissions/${application.body.id}/decision`)
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ status: 'admitted' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/v1/class-streams')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Enroll Loop G9', gradeLevel: 'G9', academicYear: 2026 })
      .expect(201);

    const enrolled = await request(app.getHttpServer())
      .post('/v1/students')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({
        fullName: 'Enroll Loop Candidate',
        gradeLevel: 'G9',
        academicYear: 2026,
        applicationId: application.body.id
      })
      .expect(201);

    const afterEnroll = await request(app.getHttpServer())
      .get('/v1/admissions')
      .set('authorization', `Bearer ${adminAToken}`)
      .expect(200);
    const linked = afterEnroll.body.find((a: { id: string }) => a.id === application.body.id);
    expect(linked.studentId).toBe(enrolled.body.studentId);
    expect(linked.status).toBe('admitted');
  });

  it('GET /students/me — a learner sees their own profile, and no one else\u2019s', async () => {
    const student = await request(app.getHttpServer())
      .post('/v1/students')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ fullName: 'Self Service Student', gradeLevel: 'G4', classStreamId, academicYear: 2026 })
      .expect(201);
    const studentId = student.body.studentId;

    // enrollStudent provisions a shadow account with an unusable
    // random password (core/identity/user-provisioning.service.ts) —
    // by design, nothing about enrollment alone lets a student log in
    // as themselves. There is currently no real, working flow that
    // gives an enrolled student actual credentials (their placeholder
    // email isn't real, so even password-reset has nowhere to send a
    // link) — a genuine, separate gap from what this test covers.
    // Setting a real password hash directly here proves the
    // GET /students/me endpoint's own logic is correct once an
    // account legitimately has credentials, the same way testing
    // guardian-linking didn't require also re-solving "how does a
    // parent get invited" from scratch.
    const realPasswordHash = await argon2.hash('A-genuinely-long-password-1', {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1
    });
    await db.query(`UPDATE core.users SET password_hash = $1 WHERE id = $2`, [realPasswordHash, studentId]);

    // The shadow account's email is a placeholder
    // (shadow.<uuid>@no-login.elimubora.internal) — fetch it directly
    // rather than guess, since the enrollment response doesn't return it.
    const shadowEmailRow = await db.query(`SELECT email FROM core.users WHERE id = $1`, [studentId]);
    const shadowEmail = shadowEmailRow.rows[0].email;

    const studentToken = (
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: shadowEmail, password: 'A-genuinely-long-password-1' })
        .expect(200)
    ).body.tokens.accessToken;

    const me = await request(app.getHttpServer())
      .get('/v1/students/me')
      .set('authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(me.body.studentId).toBe(studentId);
    expect(me.body.fullName).toBe('Self Service Student');
    expect(me.body.gradeLevel).toBe('G4');
    expect(me.body.classStreamId).toBe(classStreamId);
    expect(me.body.className).toBe('Grade 4 Blue');

    // A non-learner (staff) hitting the self-service route gets a
    // clean 403, not someone else's data and not a crash.
    await request(app.getHttpServer())
      .get('/v1/students/me')
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(403);
  });

  it('GET /announcements — staff sees everything, a learner sees whole-school plus only their own grade', async () => {
    await request(app.getHttpServer())
      .post('/v1/announcements')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ title: 'Whole school notice', body: 'Applies to everyone.' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/v1/announcements')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ title: 'Grade 4 notice', body: 'Just grade 4.', gradeLevel: 'G4' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/v1/announcements')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ title: 'Grade 9 notice', body: 'A different grade entirely.', gradeLevel: 'G9' })
      .expect(201);

    const staffView = await request(app.getHttpServer())
      .get('/v1/announcements')
      .set('authorization', `Bearer ${teacherToken}`)
      .expect(200);
    const staffTitles = staffView.body.map((a: { title: string }) => a.title);
    expect(staffTitles).toEqual(
      expect.arrayContaining(['Whole school notice', 'Grade 4 notice', 'Grade 9 notice'])
    );

    const g4Student = await request(app.getHttpServer())
      .post('/v1/students')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ fullName: 'Announcements Test Student', gradeLevel: 'G4', classStreamId, academicYear: 2026 })
      .expect(201);
    const pw = await argon2.hash('A-genuinely-long-password-1', {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1
    });
    await db.query(`UPDATE core.users SET password_hash = $1 WHERE id = $2`, [pw, g4Student.body.studentId]);
    const emailRow = await db.query(`SELECT email FROM core.users WHERE id = $1`, [g4Student.body.studentId]);
    const learnerToken = (
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: emailRow.rows[0].email, password: 'A-genuinely-long-password-1' })
        .expect(200)
    ).body.tokens.accessToken;

    const learnerView = await request(app.getHttpServer())
      .get('/v1/announcements')
      .set('authorization', `Bearer ${learnerToken}`)
      .expect(200);
    const learnerTitles = learnerView.body.map((a: { title: string }) => a.title);
    expect(learnerTitles).toContain('Whole school notice');
    expect(learnerTitles).toContain('Grade 4 notice');
    expect(learnerTitles).not.toContain('Grade 9 notice');
  });

  it('PATCH /students/:id/activate-account gives a shadow account real, usable credentials — admin-only', async () => {
    const student = await request(app.getHttpServer())
      .post('/v1/students')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ fullName: 'Activation Test Student', gradeLevel: 'G4', classStreamId, academicYear: 2026 })
      .expect(201);
    const studentId = student.body.studentId;

    await request(app.getHttpServer())
      .patch(`/v1/students/${studentId}/activate-account`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ email: `activated-${Date.now()}@school.ke`, password: 'A-genuinely-long-password-1' })
      .expect(403);

    const realEmail = `activated-${Date.now()}@school.ke`;
    const res = await request(app.getHttpServer())
      .patch(`/v1/students/${studentId}/activate-account`)
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ email: realEmail, password: 'A-genuinely-long-password-1' })
      .expect(200);
    expect(res.body.studentId).toBe(studentId);
    expect(res.body.email).toBe(realEmail);

    // The actual point: this account can now genuinely log in with
    // real, admin-chosen credentials — no direct-SQL workaround
    // needed, unlike the earlier tests in this file that had to set a
    // password hash directly because this endpoint didn't exist yet.
    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: realEmail, password: 'A-genuinely-long-password-1' })
      .expect(200);
    expect(loginRes.body.memberships[0].role).toBe('learner');

    const me = await request(app.getHttpServer())
      .get('/v1/students/me')
      .set('authorization', `Bearer ${loginRes.body.tokens.accessToken}`)
      .expect(200);
    expect(me.body.studentId).toBe(studentId);
    expect(me.body.fullName).toBe('Activation Test Student');

    // Re-activating with an email already in use elsewhere is a clean
    // 409, not a raw 500.
    const otherStudent = await request(app.getHttpServer())
      .post('/v1/students')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ fullName: 'Second Activation Student', gradeLevel: 'G4', classStreamId, academicYear: 2026 })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/v1/students/${otherStudent.body.studentId}/activate-account`)
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ email: realEmail, password: 'A-genuinely-long-password-1' })
      .expect(409);

    // A non-existent student id is a clean 404, not a silent no-op.
    await request(app.getHttpServer())
      .patch('/v1/students/00000000-0000-0000-0000-000000000000/activate-account')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ email: `nobody-${Date.now()}@school.ke`, password: 'A-genuinely-long-password-1' })
      .expect(404);
  });

  it('enrolling without classStreamId auto-assigns to the only matching stream', async () => {
    await request(app.getHttpServer())
      .post('/v1/class-streams')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Grade 7 Only Section', gradeLevel: 'G7', academicYear: 2026 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/v1/students')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ fullName: 'Auto Assign Student', gradeLevel: 'G7', academicYear: 2026 })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get('/v1/students')
      .set('authorization', `Bearer ${adminAToken}`)
      .expect(200);
    const enrolled = list.body.find((s: { fullName: string }) => s.fullName === 'Auto Assign Student');
    expect(enrolled.className).toBe('Grade 7 Only Section');
  });

  it('with multiple matching streams, auto-assignment load-balances to the least-populated one', async () => {
    await request(app.getHttpServer())
      .post('/v1/class-streams')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Grade 8 Alpha', gradeLevel: 'G8', academicYear: 2026 })
      .expect(201);
    await request(app.getHttpServer())
      .post('/v1/class-streams')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Grade 8 Beta', gradeLevel: 'G8', academicYear: 2026 })
      .expect(201);

    // Both start at zero students — tie-broken alphabetically, so the
    // first enrollment should land in "Grade 8 Alpha".
    await request(app.getHttpServer())
      .post('/v1/students')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ fullName: 'Load Balance One', gradeLevel: 'G8', academicYear: 2026 })
      .expect(201);
    // Now Alpha has 1, Beta has 0 — the second enrollment should go
    // to Beta, proving this is genuinely counting allocations rather
    // than always picking the same (e.g. first-created) stream.
    await request(app.getHttpServer())
      .post('/v1/students')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ fullName: 'Load Balance Two', gradeLevel: 'G8', academicYear: 2026 })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get('/v1/students')
      .set('authorization', `Bearer ${adminAToken}`)
      .expect(200);
    const one = list.body.find((s: { fullName: string }) => s.fullName === 'Load Balance One');
    const two = list.body.find((s: { fullName: string }) => s.fullName === 'Load Balance Two');
    expect(one.className).toBe('Grade 8 Alpha');
    expect(two.className).toBe('Grade 8 Beta');
  });

  it('enrolling without classStreamId when no stream exists for that grade/year is a clear 400, not a confusing failure', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/students')
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ fullName: 'No Class Available', gradeLevel: 'G12', academicYear: 2026 })
      .expect(400);
    expect(res.body.message).toContain('No class exists yet for G12 in 2026');
  });

  it('PATCH /students/:id/photo updates the photo, and the student profile reflects it back', async () => {
    const tinyPngDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

    await request(app.getHttpServer())
      .patch(`/v1/students/${studentId}/photo`)
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ photoDataUrl: tinyPngDataUrl })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`/v1/students/${studentId}`)
      .set('authorization', `Bearer ${adminAToken}`)
      .expect(200);
    expect(res.body.photoDataUrl).toBe(tinyPngDataUrl);
  });

  it('PATCH /students/:id/photo rejects a non-image data URL with a clean 400', async () => {
    await request(app.getHttpServer())
      .patch(`/v1/students/${studentId}/photo`)
      .set('authorization', `Bearer ${adminAToken}`)
      .send({ photoDataUrl: 'not-an-image' })
      .expect(400);
  });
});

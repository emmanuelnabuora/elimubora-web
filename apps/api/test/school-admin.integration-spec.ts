import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { APP_CONFIG, type AppConfig } from '../src/config/configuration';

const appUrl = process.env.INTEGRATION_DATABASE_URL;
const adminUrl = process.env.INTEGRATION_ADMIN_DATABASE_URL ?? appUrl;
const d = appUrl ? describe : describe.skip;

d('School Administration (integration)', () => {
  let app: INestApplication;
  let db: Client;
  let tenantId: string;

  const stamp = Date.now();
  const password = 'A-genuinely-long-password-1';
  const adminEmail = `sa-admin-${stamp}@school.ke`;
  const teacherEmail = `sa-teacher-${stamp}@school.ke`;
  const teacher2Email = `sa-teacher2-${stamp}@school.ke`;

  let adminToken: string;
  let teacherId: string;
  let teacher2Id: string;
  let roomId: string;
  let room2Id: string;
  let classStreamId: string;
  let classStream2Id: string;
  let courseId: string;

  const config: AppConfig = {
    nodeEnv: 'test',
    port: 0,
    databaseUrl: appUrl as string,
    workerDatabaseUrl: appUrl as string,
    outboxPollMs: 60_000,
    syncVisibilityDelaySeconds: 0,
    publicWebUrl: 'http://localhost:3000',
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
      `INSERT INTO core.tenants (slug, name, kind) VALUES ($1, 'School Admin Test School', 'school') RETURNING id`,
      [`sa-school-${stamp}`]
    );
    tenantId = t.rows[0].id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(config)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1', { exclude: ['health'] });
    await app.init();

    for (const [email, role] of [
      [adminEmail, 'school_admin'],
      [teacherEmail, 'teacher'],
      [teacher2Email, 'teacher']
    ] as const) {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email, fullName: 'SA Person', password, tenantId, role })
        .expect(201);
    }
    adminToken = await login(adminEmail);
    const teacherToken = await login(teacherEmail);

    teacherId = (
      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('authorization', `Bearer ${teacherToken}`)
        .expect(200)
    ).body.id;
    const teacher2Token = await login(teacher2Email);
    teacher2Id = (
      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('authorization', `Bearer ${teacher2Token}`)
        .expect(200)
    ).body.id;

    const room = await request(app.getHttpServer())
      .post('/v1/rooms')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ name: 'Room A', capacity: 30, roomType: 'classroom' })
      .expect(201);
    roomId = room.body.id;
    const room2 = await request(app.getHttpServer())
      .post('/v1/rooms')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ name: 'Room B', capacity: 30, roomType: 'classroom' })
      .expect(201);
    room2Id = room2.body.id;

    const stream = await request(app.getHttpServer())
      .post('/v1/class-streams')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ name: 'Grade 6 Silver', gradeLevel: 'G6', academicYear: 2026 })
      .expect(201);
    classStreamId = stream.body.id;
    const stream2 = await request(app.getHttpServer())
      .post('/v1/class-streams')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ name: 'Grade 6 Bronze', gradeLevel: 'G6', academicYear: 2026 })
      .expect(201);
    classStream2Id = stream2.body.id;

    const course = await request(app.getHttpServer())
      .post('/v1/courses')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Grade 6 Science', learningArea: 'Science', gradeLevel: 'G6' })
      .expect(201);
    courseId = course.body.id;
  });

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it('a teacher cannot create a timetable slot (admin-only)', async () => {
    const teacherToken = await login(teacherEmail);
    await request(app.getHttpServer())
      .post('/v1/timetable')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({
        classStreamId,
        courseId,
        teacherId,
        roomId,
        academicYear: 2026,
        dayOfWeek: 1,
        startTime: '08:00',
        endTime: '09:00'
      })
      .expect(403);
  });

  it('creates the first timetable slot', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/timetable')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        classStreamId,
        courseId,
        teacherId,
        roomId,
        academicYear: 2026,
        dayOfWeek: 1,
        startTime: '08:00',
        endTime: '09:00'
      })
      .expect(201);
    expect(res.body).toMatchObject({ startMin: 480, endMin: 540 });
  });

  it('rejects an overlapping slot for the SAME TEACHER in a different room/class — 409, not 500', async () => {
    await request(app.getHttpServer())
      .post('/v1/timetable')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        classStreamId: classStream2Id,
        courseId,
        teacherId,
        roomId: room2Id,
        academicYear: 2026,
        dayOfWeek: 1,
        startTime: '08:30',
        endTime: '09:30'
      })
      .expect(409);
  });

  it('rejects an overlapping slot for the SAME ROOM with a different teacher/class', async () => {
    await request(app.getHttpServer())
      .post('/v1/timetable')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        classStreamId: classStream2Id,
        courseId,
        teacherId: teacher2Id,
        roomId,
        academicYear: 2026,
        dayOfWeek: 1,
        startTime: '08:15',
        endTime: '08:45'
      })
      .expect(409);
  });

  it('rejects an overlapping slot for the SAME CLASS STREAM even with a different teacher/room', async () => {
    await request(app.getHttpServer())
      .post('/v1/timetable')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        classStreamId,
        courseId,
        teacherId: teacher2Id,
        roomId: room2Id,
        academicYear: 2026,
        dayOfWeek: 1,
        startTime: '08:45',
        endTime: '09:15'
      })
      .expect(409);
  });

  it('allows a genuinely non-overlapping, back-to-back slot for the same teacher and room', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/timetable')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        classStreamId,
        courseId,
        teacherId,
        roomId,
        academicYear: 2026,
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '10:00'
      })
      .expect(201);
    expect(res.body.startMin).toBe(540);

    const timetable = await request(app.getHttpServer())
      .get(`/v1/timetable/class/${classStreamId}`)
      .query({ academicYear: 2026 })
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(timetable.body).toHaveLength(2);
  });

  it('allows the same teacher to have a slot on a DIFFERENT day at the same time (no false conflict)', async () => {
    await request(app.getHttpServer())
      .post('/v1/timetable')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        classStreamId,
        courseId,
        teacherId,
        roomId,
        academicYear: 2026,
        dayOfWeek: 2,
        startTime: '08:00',
        endTime: '09:00'
      })
      .expect(201);
  });

  it('staff can submit a leave request; approving it is admin-only and self-approval is blocked', async () => {
    const teacherToken = await login(teacherEmail);
    const leave = await request(app.getHttpServer())
      .post('/v1/leave-requests')
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ leaveType: 'sick', startDate: '2026-08-10', endDate: '2026-08-12', reason: 'Flu' })
      .expect(201);
    expect(leave.body.status).toBe('pending');

    await request(app.getHttpServer())
      .patch(`/v1/leave-requests/${leave.body.id}/decision`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ status: 'approved' })
      .expect(403);

    const decided = await request(app.getHttpServer())
      .patch(`/v1/leave-requests/${leave.body.id}/decision`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' })
      .expect(200);
    expect(decided.body.status).toBe('approved');

    const teacher2Token = await login(teacher2Email);
    await request(app.getHttpServer())
      .get(`/v1/leave-requests/staff/${teacherId}`)
      .set('authorization', `Bearer ${teacher2Token}`)
      .expect(403);
    const asAdmin = await request(app.getHttpServer())
      .get(`/v1/leave-requests/staff/${teacherId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(asAdmin.body).toHaveLength(1);
  });

  it('an admin cannot approve their own leave request either', async () => {
    const ownLeave = await request(app.getHttpServer())
      .post('/v1/leave-requests')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ leaveType: 'annual', startDate: '2026-09-01', endDate: '2026-09-05' })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/v1/leave-requests/${ownLeave.body.id}/decision`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' })
      .expect(403);
  });
});

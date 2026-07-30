import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { APP_CONFIG, type AppConfig } from '../src/config/configuration';
import { DatabaseService } from '../src/core/database/database.service';
import { WorkerDatabaseService } from '../src/core/database/worker-database.service';
import { OutboxRelay } from '../src/core/outbox/outbox.relay';

const testConfig: AppConfig = {
  nodeEnv: 'test',
  port: 0,
  databaseUrl: 'postgres://test:test@localhost:5432/test',
  workerDatabaseUrl: 'postgres://test:test@localhost:5432/test',
  outboxPollMs: 1000,
  syncVisibilityDelaySeconds: 0,
  publicWebUrl: 'http://localhost:3000',
  auth: {
    invitationTtlDays: 7,
    passwordResetTtlMinutes: 30,
    jwtSecret: 'test-secret-test-secret-test-secret!',
    encKeyHex: '0123456789abcdef'.repeat(4),
    accessTtlSeconds: 900,
    refreshTtlDays: 30,
    allowOpenRegistration: false
  }
};

describe('API foundation (e2e)', () => {
  let app: INestApplication;
  const dbMock = {
    ping: jest.fn(async () => 1.23),
    query: jest.fn(async () => ({ rows: [] })),
    withContext: jest.fn(async () => []),
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn()
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(testConfig)
      .overrideProvider(DatabaseService)
      .useValue(dbMock)
      .overrideProvider(OutboxRelay)
      .useValue({ onModuleInit: jest.fn(), onModuleDestroy: jest.fn() })
      .overrideProvider(WorkerDatabaseService)
      .useValue({ onModuleInit: jest.fn(), onModuleDestroy: jest.fn(), query: jest.fn() })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1', { exclude: ['health'] });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health is public and reports service and database status', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      service: 'elimubora-api',
      db: { status: 'ok', latencyMs: 1.23 }
    });
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('GET /health returns 503 when the database is unreachable', async () => {
    dbMock.ping.mockRejectedValueOnce(new Error('down'));
    await request(app.getHttpServer()).get('/health').expect(503);
  });

  it('protected routes reject requests without a bearer token', async () => {
    await request(app.getHttpServer()).get('/v1/auth/me').expect(401);
  });

  it('protected routes reject forged bearer tokens', async () => {
    await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('authorization', 'Bearer not.a.jwt')
      .expect(401);
  });

  it('registration endpoint is closed when the flag is off', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: 'x@y.ke',
        fullName: 'X Y',
        password: 'long-enough-password',
        tenantId: '4b4b4b4b-4b4b-4b4b-8b4b-4b4b4b4b4b4b',
        role: 'teacher'
      })
      .expect(403);
  });

  it('rejects a malformed x-tenant-id header (dev convenience path)', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .set('x-tenant-id', 'not-a-uuid')
      .expect(400);
  });

  it('echoes a caller-supplied x-request-id for traceability', async () => {
    const res = await request(app.getHttpServer())
      .get('/health')
      .set('x-request-id', 'trace-me-1')
      .expect(200);
    expect(res.headers['x-request-id']).toBe('trace-me-1');
  });
});

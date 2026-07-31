import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

const appUrl = process.env.INTEGRATION_DATABASE_URL;
const d = appUrl ? describe : describe.skip;

/**
 * Every other test in this codebase boots the app via
 * Test.createTestingModule(...).compile(), which never executes
 * main.ts's bootstrap() function or its exact module-construction
 * path. That gap let main.ts reference @nestjs/common's
 * ValidationPipe -- requiring class-validator, a peer dependency this
 * codebase never installed because it uses Zod exclusively -- for
 * fourteen sprints without any of the 140+ passing tests ever
 * exercising it (ADR-014). This test exists specifically to close
 * that gap: it constructs the app the same way main.ts does
 * (NestFactory.create, no TestingModule) so a similarly "invisible to
 * every other test" bootstrap failure fails loudly here instead.
 */
d('Application bootstrap (integration)', () => {
  let app: INestApplication | undefined;

  beforeAll(() => {
    process.env.DATABASE_URL = appUrl;
    process.env.WORKER_DATABASE_URL =
      process.env.INTEGRATION_WORKER_DATABASE_URL ??
      'postgres://elimubora_worker:worker_dev_password@localhost:5432/elimubora';
    process.env.AUTH_JWT_SECRET = 'bootstrap-test-secret-bootstrap-test-secret';
    process.env.AUTH_ENC_KEY = '0123456789abcdef'.repeat(4);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('constructs and initializes the real application graph without a TestingModule bypass', async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('v1', { exclude: ['health'] });
    await expect(app.init()).resolves.not.toThrow();
  });
});

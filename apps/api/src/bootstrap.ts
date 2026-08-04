import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import helmet from 'helmet';
import type { AppConfig } from './config/configuration';
import { GlobalExceptionFilter } from './core/http/global-exception.filter';

/**
 * Global app configuration applied identically regardless of
 * entrypoint. Extends ADR-014's lesson (a global ValidationPipe that
 * only existed in main.ts was invisible to every TestingModule-based
 * test for fourteen sprints): body-parser limits, security headers,
 * compression, CORS, and error handling are exactly the class of
 * "bootstrap-only" configuration that silently doesn't apply unless
 * every entrypoint remembers to set it separately. Call this from
 * main.ts AND from any test that needs the real request-handling
 * behavior (large uploads, security headers) rather than duplicating
 * any of this inline in each place.
 */
export function applyGlobalAppConfig(app: INestApplication, config: AppConfig): void {
  app.setGlobalPrefix('v1', { exclude: ['health'] });
  // Base64-encodes an ~8 MB photo (Sprint 15's MAX_UPLOAD_BYTES) at
  // roughly 33% overhead — comfortably under this limit with headroom
  // for the rest of the JSON envelope.
  (app as NestExpressApplication).useBodyParser('json', { limit: '15mb' });

  app.use(helmet());
  app.use(compression());

  app.enableCors({
    origin: config.corsAllowedOrigins,
    credentials: true
  });

  // Ensures a genuinely unexpected error (a raw DB error, a bug) never
  // leaks internal detail to a client in production, while always
  // logging the full error server-side. This is a safety net for
  // whatever the *next* unhandled case turns out to be — the
  // duplicate-email 500 found earlier this project was fixed at its
  // actual source (a proper ConflictException in the repository
  // layer), which is still the right fix for any *known,
  // recoverable* case; this filter only ever gets to a request that
  // wasn't already handled that way.
  app.useGlobalFilters(new GlobalExceptionFilter());
}

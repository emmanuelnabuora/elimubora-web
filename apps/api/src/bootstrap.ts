import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Global app configuration applied identically regardless of
 * entrypoint. Extends ADR-014's lesson (a global ValidationPipe that
 * only existed in main.ts was invisible to every TestingModule-based
 * test for fourteen sprints): body-parser limits are exactly the same
 * class of "bootstrap-only" configuration that silently doesn't apply
 * unless every entrypoint remembers to set it separately. Call this
 * from main.ts AND from any test that needs the real request-handling
 * behavior (large uploads, in this case) rather than duplicating the
 * limit value inline in each place.
 */
export function applyGlobalAppConfig(app: INestApplication): void {
  app.setGlobalPrefix('v1', { exclude: ['health'] });
  // Base64-encodes an ~8 MB photo (Sprint 15's MAX_UPLOAD_BYTES) at
  // roughly 33% overhead — comfortably under this limit with headroom
  // for the rest of the JSON envelope.
  (app as NestExpressApplication).useBodyParser('json', { limit: '15mb' });
}

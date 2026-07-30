import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  NestMiddleware
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import { TenantContext } from './tenant-context';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Establishes the per-request context. Authenticated requests get
 * their tenant/actor bound by JwtAuthGuard from VERIFIED token
 * claims (the guard mutates this context). The `x-tenant-id` header
 * remains only as a development convenience and is ignored in
 * production.
 */
@Injectable()
export class TenancyMiddleware implements NestMiddleware {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
    res.setHeader('x-request-id', requestId);

    let tenantId: string | undefined;
    if (this.config.nodeEnv !== 'production') {
      const rawTenant = req.headers['x-tenant-id'] as string | undefined;
      if (rawTenant !== undefined && !UUID_RE.test(rawTenant)) {
        throw new BadRequestException('x-tenant-id must be a UUID');
      }
      tenantId = rawTenant;
    }

    TenantContext.run({ requestId, tenantId }, () => next());
  }
}

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { DatabaseService } from '../../core/database/database.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { IS_PUBLIC_KEY } from '../../core/auth/public.decorator';
import type { AuthenticatedUser } from './identity.types';
import { TokenService } from './token.service';

/**
 * Global authentication guard. On success it (a) attaches the principal
 * to the request and (b) REBINDS the ambient tenant context from
 * verified claims — from this point on, RLS operates on the tenant the
 * token was issued for, and nothing a client sends in headers can
 * change that.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly db: DatabaseService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let claims;
    try {
      claims = await this.tokens.verify(header.slice('Bearer '.length), 'access');
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Signature + expiry verification alone only proves this token was
    // validly issued and hasn't hit its own TTL -- it says nothing
    // about whether the session behind it has since been revoked
    // (platform_admin clicking "revoke sessions", or deleting the user
    // or their institution, both of which also revoke sessions in the
    // same transaction -- see platform-admin.repository.ts). Every
    // access token carries the refresh-token family it was issued
    // alongside (sid); without checking that family is still live,
    // "revoked" would only take effect once the access token's own TTL
    // naturally expired -- up to AUTH_ACCESS_TTL_SECONDS (15 minutes by
    // default) of continued access after an administrator believed
    // they'd cut it off immediately. core.refresh_tokens has no RLS,
    // so this is a plain, ungated lookup on an indexed column
    // (idx_refresh_family) -- deliberately kept to a single EXISTS
    // check, since this now runs on every authenticated request in the
    // app. That's a real, ongoing tradeoff worth knowing about: one
    // extra query per request against a deliberately small connection
    // pool (max 4 per instance, shared against a 50-connection Postgres
    // ceiling across however many Cloud Run instances are running) --
    // correctness over shaving a query off the hot path. If this ever
    // shows up as real connection pressure, a short-lived in-memory
    // cache of recently-checked, still-valid family ids (a few seconds
    // TTL) is the natural next step: it trades a few seconds of
    // residual exposure after a revoke for a large cut in query volume,
    // which is a far better trade than the 15-minute window this
    // replaces.
    const session = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM core.refresh_tokens
          WHERE family_id = $1 AND revoked_at IS NULL
       ) AS exists`,
      [claims.sid]
    );
    if (!session.rows[0]?.exists) {
      throw new UnauthorizedException('Session revoked');
    }

    req.user = {
      userId: claims.sub,
      tenantId: claims.ten,
      role: claims.rol,
      sessionId: claims.sid
    };

    const ctx = TenantContext.current();
    if (ctx) {
      ctx.tenantId = claims.ten;
      ctx.actorId = claims.sub;
    }
    return true;
  }
}

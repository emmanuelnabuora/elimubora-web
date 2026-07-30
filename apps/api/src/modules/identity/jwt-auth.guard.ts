import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
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
    private readonly tokens: TokenService
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

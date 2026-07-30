import {
  createParamDecorator,
  SetMetadata,
  type ExecutionContext
} from '@nestjs/common';
import type { AuthenticatedUser, MembershipRole } from './auth.types';

export { IS_PUBLIC_KEY, Public } from './public.decorator';

export const ROLES_KEY = 'roles';
/** Restricts a route to the given membership roles. */
export const Roles = (...roles: MembershipRole[]) => SetMetadata(ROLES_KEY, roles);

/** Injects the authenticated principal attached by the JWT guard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!req.user) throw new Error('CurrentUser used on an unauthenticated route');
    return req.user;
  }
);

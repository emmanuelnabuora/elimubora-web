import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** Marks a route as reachable without authentication. Lives in core so
 *  both core controllers (health) and domain modules can use it. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Cookie constants shared by every auth Route Handler. Tokens live in
 * httpOnly cookies — never in a client-readable store (no
 * localStorage/sessionStorage) — so a browser XSS bug can't exfiltrate
 * a session. The Next.js server is a thin BFF: the browser only ever
 * talks to same-origin `/api/auth/*` routes, which attach the
 * Authorization header server-side before proxying to the NestJS API.
 */
export const ACCESS_COOKIE = 'eb_access';
export const REFRESH_COOKIE = 'eb_refresh';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds
  };
}

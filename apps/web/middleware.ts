import { NextResponse, type NextRequest } from 'next/server';
import { ACCESS_COOKIE, API_BASE_URL, cookieOptions, REFRESH_COOKIE } from './lib/auth-cookies';

// Default from AUTH_REFRESH_TTL_DAYS in apps/api/src/config/configuration.ts.
// Keep these in sync if that env var/default ever changes.
const REFRESH_TTL_DAYS = 30;
const REFRESH_TTL_SECONDS = REFRESH_TTL_DAYS * 24 * 60 * 60;

/**
 * Runs once per incoming browser request, before any Server Component
 * renders. This is what api-client.ts's resolveAccessToken() cannot
 * do on its own: Server Components can't set cookies, so a refresh
 * triggered there never persists, and multiple parallel Server
 * Component fetches on the same page each independently call
 * /v1/auth/refresh, racing on rotation. Doing it here instead means
 * exactly one refresh per request, with the result written back to
 * cookies before any page code runs.
 */
export async function middleware(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  if (accessToken) {
    return NextResponse.next();
  }

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    // No session at all — let the page/layout's own auth check redirect to login.
    return NextResponse.next();
  }

  try {
    const res = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store'
    });

    if (!res.ok) {
      // Refresh token invalid/expired/revoked. Clear both cookies so the
      // page's auth check sees a clean unauthenticated state rather than
      // repeatedly retrying a dead refresh token on every request.
      const response = NextResponse.next();
      response.cookies.delete(ACCESS_COOKIE);
      response.cookies.delete(REFRESH_COOKIE);
      return response;
    }

    const data = await res.json();
    const response = NextResponse.next();
    response.cookies.set(ACCESS_COOKIE, data.accessToken, cookieOptions(data.expiresInSeconds));
    response.cookies.set(REFRESH_COOKIE, data.refreshToken, cookieOptions(REFRESH_TTL_SECONDS));
    return response;
  } catch (err) {
    // Network/API failure talking to the refresh endpoint — don't lock
    // the user out on a transient error. Let the request through with
    // whatever cookies it already has; a downstream 401 is a safer
    // failure mode than middleware itself going down.
    return NextResponse.next();
  }
}

export const config = {
  // Skip static assets and the auth Route Handlers themselves (which
  // would otherwise recurse into this same refresh logic). Adjust the
  // login/public-page exclusions to match your actual route names.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|api/auth).*)']
};

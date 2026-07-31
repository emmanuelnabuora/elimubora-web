import { cookies } from 'next/headers';
import { ACCESS_COOKIE, API_BASE_URL, REFRESH_COOKIE } from './auth-cookies';

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  totpEnabled: boolean;
  activeTenantId: string;
  role: string;
  memberships: Array<{ tenantId: string; tenantSlug: string; tenantName: string; role: string }>;
}

interface Refreshed {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

async function fetchMe(accessToken: string): Promise<Response> {
  return fetch(`${API_BASE_URL}/v1/auth/me`, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store'
  });
}

/**
 * Server-only: resolves the signed-in user from the httpOnly cookies,
 * silently refreshing the access token once if it has expired. Used
 * directly by server components (the dashboard) and by the
 * /api/auth/me Route Handler — one implementation, not a
 * self-referential fetch from a server component to its own API route.
 *
 * Returns null (never throws) when there is no valid session — callers
 * decide whether that means a redirect or an empty state.
 */
export async function getCurrentUser(): Promise<{ user: CurrentUser; refreshed: Refreshed | null } | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (!accessToken && !refreshToken) return null;

  if (accessToken) {
    const res = await fetchMe(accessToken);
    if (res.ok) {
      return { user: await res.json(), refreshed: null };
    }
  }

  if (!refreshToken) return null;

  const refreshRes = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });
  if (!refreshRes.ok) return null;

  const refreshed: Refreshed = await refreshRes.json();
  const meRes = await fetchMe(refreshed.accessToken);
  if (!meRes.ok) return null;

  return { user: await meRes.json(), refreshed };
}

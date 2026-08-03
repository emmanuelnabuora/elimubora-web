import { cookies } from 'next/headers';
import { ACCESS_COOKIE, API_BASE_URL, REFRESH_COOKIE } from './auth-cookies';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

/**
 * Resolves a valid access token from the session cookies, refreshing
 * once if the current one is missing (expired access tokens are
 * still tried first — the API itself will 401 if actually expired,
 * which callers surface as an ApiError). Note: if a refresh happens
 * here, the new cookie isn't persisted (Server Components can't set
 * cookies) — same limitation as getCurrentUser(), and for the same
 * reason: the next request through a Route Handler will refresh again
 * if needed, with no user-visible effect beyond an extra request.
 */
async function resolveAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  if (accessToken) return accessToken;

  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;

  const res = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store'
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.accessToken as string;
}

/**
 * Server-only authenticated call against the real NestJS API, using
 * the current session. Every admin/teacher/parent page that needs
 * real data goes through this rather than each page reimplementing
 * token resolution and error handling separately.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await resolveAccessToken();
  if (!token) throw new ApiError(401, 'Not signed in');

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    cache: 'no-store'
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

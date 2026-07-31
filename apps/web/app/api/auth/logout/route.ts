import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, API_BASE_URL, REFRESH_COOKIE } from '../../../../lib/auth-cookies';

export async function POST(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (refreshToken) {
    // Best-effort: revoke the session family server-side even if this
    // call fails, the cookies are cleared below regardless.
    await fetch(`${API_BASE_URL}/v1/auth/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    }).catch(() => undefined);
  }

  const res = NextResponse.json({ status: 'logged_out' });
  res.cookies.delete(ACCESS_COOKIE);
  res.cookies.delete(REFRESH_COOKIE);
  return res;
}

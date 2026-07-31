import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, API_BASE_URL, REFRESH_COOKIE, cookieOptions } from '../../../../lib/auth-cookies';

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json();

  const upstream = await fetch(`${API_BASE_URL}/v1/auth/mfa/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await upstream.json();

  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status });
  }

  const res = NextResponse.json({ status: 'authenticated' });
  res.cookies.set(ACCESS_COOKIE, data.accessToken, cookieOptions(data.expiresInSeconds));
  res.cookies.set(REFRESH_COOKIE, data.refreshToken, cookieOptions(60 * 60 * 24 * 30));
  return res;
}

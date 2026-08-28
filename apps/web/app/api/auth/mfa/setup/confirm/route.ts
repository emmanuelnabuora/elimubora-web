import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, API_BASE_URL, REFRESH_COOKIE, cookieOptions } from '../../../../../../lib/auth-cookies';

/** Proxies POST /v1/auth/mfa/setup/confirm — completes mandatory TOTP setup and issues a real session. */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Malformed request body.' }, { status: 400 });
  }
  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE_URL}/v1/auth/mfa/setup/confirm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (err) {
    console.error('MFA setup confirm route: failed to reach upstream API', API_BASE_URL, err);
    return NextResponse.json(
      { message: 'Could not reach the authentication service. Please try again shortly.' },
      { status: 502 }
    );
  }
  let data: Record<string, unknown>;
  try {
    data = await upstream.json();
  } catch (err) {
    console.error('MFA setup confirm route: upstream response was not valid JSON', err);
    return NextResponse.json(
      { message: 'The authentication service returned an unexpected response.' },
      { status: 502 }
    );
  }
  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status });
  }
  const res = NextResponse.json({ status: 'authenticated' });
  const accessToken = data.accessToken as string;
  const refreshToken = data.refreshToken as string;
  const expiresInSeconds = data.expiresInSeconds as number;
  res.cookies.set(ACCESS_COOKIE, accessToken, cookieOptions(expiresInSeconds));
  res.cookies.set(REFRESH_COOKIE, refreshToken, cookieOptions(60 * 60 * 24 * 30));
  return res;
}

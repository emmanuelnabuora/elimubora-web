import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, API_BASE_URL, REFRESH_COOKIE, cookieOptions } from '../../../../lib/auth-cookies';

/**
 * Proxies POST /v1/auth/login. On a fully authenticated result, the
 * real tokens are written to httpOnly cookies here — server-side only
 * — and the JSON sent back to the browser carries just a status flag
 * plus non-secret membership info, never the tokens themselves.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json();

  const upstream = await fetch(`${API_BASE_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await upstream.json();

  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status });
  }

  if (data.kind === 'authenticated') {
    const res = NextResponse.json({ status: 'authenticated', memberships: data.memberships });
    res.cookies.set(ACCESS_COOKIE, data.tokens.accessToken, cookieOptions(data.tokens.expiresInSeconds));
    res.cookies.set(REFRESH_COOKIE, data.tokens.refreshToken, cookieOptions(60 * 60 * 24 * 30));
    return res;
  }

  if (data.kind === 'mfa_required') {
    return NextResponse.json({ status: 'mfa_required', mfaToken: data.mfaToken });
  }

  if (data.kind === 'select_institution') {
    return NextResponse.json({ status: 'select_institution', memberships: data.memberships });
  }

  return NextResponse.json({ message: 'Unexpected response from the server.' }, { status: 502 });
}

import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, API_BASE_URL, REFRESH_COOKIE, cookieOptions } from '../../../../lib/auth-cookies';

/**
 * Proxies POST /v1/auth/login. On a fully authenticated result, the
 * real tokens are written to httpOnly cookies here — server-side only
 * — and the JSON sent back to the browser carries just a status flag
 * plus non-secret membership info, never the tokens themselves.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Malformed request body.' }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE_URL}/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (err) {
    // A real, previously-silent failure mode: if this ever throws (DNS,
    // connection refused, timeout — or API_BASE_URL itself being
    // unexpectedly empty), the route used to crash with an opaque,
    // bodyless 500 that gave zero diagnostic information. This is the
    // fix, found via an actual empty-body 500 in production, not
    // hypothetical.
    console.error('Login route: failed to reach upstream API', API_BASE_URL, err);
    return NextResponse.json(
      { message: 'Could not reach the authentication service. Please try again shortly.' },
      { status: 502 }
    );
  }

  let data: Record<string, unknown>;
  try {
    data = await upstream.json();
  } catch (err) {
    console.error('Login route: upstream response was not valid JSON', err);
    return NextResponse.json(
      { message: 'The authentication service returned an unexpected response.' },
      { status: 502 }
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status });
  }

  if (data.kind === 'authenticated') {
    const tokens = data.tokens as { accessToken: string; refreshToken: string; expiresInSeconds: number };
    const res = NextResponse.json({ status: 'authenticated', memberships: data.memberships });
    res.cookies.set(ACCESS_COOKIE, tokens.accessToken, cookieOptions(tokens.expiresInSeconds));
    res.cookies.set(REFRESH_COOKIE, tokens.refreshToken, cookieOptions(60 * 60 * 24 * 30));
    return res;
  }

  if (data.kind === 'mfa_required') {
    return NextResponse.json({ status: 'mfa_required', mfaToken: data.mfaToken });
  }
  if (data.kind === 'mfa_setup_required') {
    return NextResponse.json({ status: 'mfa_setup_required', mfaToken: data.mfaToken });
  }

  if (data.kind === 'select_institution') {
    return NextResponse.json({ status: 'select_institution', memberships: data.memberships });
  }

  return NextResponse.json({ message: 'Unexpected response from the server.' }, { status: 502 });
}

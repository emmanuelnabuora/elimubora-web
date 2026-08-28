import { NextResponse } from 'next/server';
import { API_BASE_URL } from '../../../../../../lib/auth-cookies';

/** Proxies POST /v1/auth/mfa/setup/enroll — starts mandatory TOTP setup for a platform_admin. */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Malformed request body.' }, { status: 400 });
  }
  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE_URL}/v1/auth/mfa/setup/enroll`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (err) {
    console.error('MFA setup enroll route: failed to reach upstream API', API_BASE_URL, err);
    return NextResponse.json(
      { message: 'Could not reach the authentication service. Please try again shortly.' },
      { status: 502 }
    );
  }
  let data: Record<string, unknown>;
  try {
    data = await upstream.json();
  } catch (err) {
    console.error('MFA setup enroll route: upstream response was not valid JSON', err);
    return NextResponse.json(
      { message: 'The authentication service returned an unexpected response.' },
      { status: 502 }
    );
  }
  return NextResponse.json(data, { status: upstream.status });
}

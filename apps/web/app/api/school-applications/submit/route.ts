import { NextResponse } from 'next/server';
import { API_BASE_URL } from '../../../../lib/auth-cookies';

/**
 * Proxies the public POST /v1/school-applications directly -- not
 * through apiFetch, which requires an existing session. A school
 * applying has no account at all yet, by design (see
 * school-applications.service.ts): this is the entire point of the
 * endpoint. Matches the same direct-fetch pattern the invitation
 * accept/decline routes already use for the same reason.
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
    upstream = await fetch(`${API_BASE_URL}/v1/school-applications`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (err) {
    console.error('School application submit route: failed to reach upstream API', API_BASE_URL, err);
    return NextResponse.json(
      { message: 'Could not reach the server. Please try again shortly.' },
      { status: 502 }
    );
  }

  let data: Record<string, unknown>;
  try {
    data = await upstream.json();
  } catch (err) {
    console.error('School application submit route: upstream response was not valid JSON', err);
    return NextResponse.json({ message: 'The server returned an unexpected response.' }, { status: 502 });
  }

  return NextResponse.json(data, { status: upstream.status });
}

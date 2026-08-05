import { NextResponse } from 'next/server';
import { API_BASE_URL } from '../../../../../lib/auth-cookies';

/**
 * Proxies the public POST /v1/auth/invitations/accept directly --
 * NOT through apiFetch, which requires an existing session and throws
 * 'Not signed in' immediately for exactly the unauthenticated,
 * brand-new visitor this route exists for. A real bug caught live:
 * the underlying accept genuinely worked when tested directly against
 * the API, but this route reported failure for every real user
 * because of that mismatch. Matches the same direct-fetch pattern the
 * login route already uses for the same reason.
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
    upstream = await fetch(`${API_BASE_URL}/v1/auth/invitations/accept`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (err) {
    console.error('Accept invitation route: failed to reach upstream API', API_BASE_URL, err);
    return NextResponse.json(
      { message: 'Could not reach the server. Please try again shortly.' },
      { status: 502 }
    );
  }

  let data: Record<string, unknown>;
  try {
    data = await upstream.json();
  } catch (err) {
    console.error('Accept invitation route: upstream response was not valid JSON', err);
    return NextResponse.json({ message: 'The server returned an unexpected response.' }, { status: 502 });
  }

  return NextResponse.json(data, { status: upstream.status });
}

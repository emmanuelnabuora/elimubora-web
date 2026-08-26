import { NextResponse } from 'next/server';
import { API_BASE_URL } from '../../../../../lib/auth-cookies';

/**
 * Proxies POST /v1/auth/password/forgot directly, not through apiFetch —
 * this is reachable by a signed-out visitor who has no session, same
 * reasoning as the login and invitation-accept routes. The upstream
 * endpoint always returns a uniform 204 No Content regardless of
 * whether the email matches an account (nothing to leak either way),
 * so this route must not assume a JSON body is present -- calling
 * .json() on a genuinely empty 204 response throws, which is exactly
 * what was happening here before this fix.
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
    upstream = await fetch(`${API_BASE_URL}/v1/auth/password/forgot`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (err) {
    console.error('Forgot password route: failed to reach upstream API', API_BASE_URL, err);
    return NextResponse.json(
      { message: 'Could not reach the server. Please try again shortly.' },
      { status: 502 }
    );
  }

  if (upstream.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  let data: Record<string, unknown>;
  try {
    data = await upstream.json();
  } catch (err) {
    console.error('Forgot password route: upstream response was not valid JSON', err);
    return NextResponse.json({ message: 'The server returned an unexpected response.' }, { status: 502 });
  }

  return NextResponse.json(data, { status: upstream.status });
}

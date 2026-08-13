import { NextResponse } from 'next/server';
import { API_BASE_URL } from '../../../../../../lib/auth-cookies';

/**
 * Proxies the public GET /v1/guardian-invitations/preview/:token
 * directly -- not through apiFetch, matching accept/decline right
 * next to this one: whoever is previewing an invitation hasn't
 * necessarily logged in at all.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  const { token } = await params;

  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE_URL}/v1/guardian-invitations/preview/${encodeURIComponent(token)}`);
  } catch (err) {
    console.error('Preview invitation route: failed to reach upstream API', API_BASE_URL, err);
    return NextResponse.json(
      { message: 'Could not reach the server. Please try again shortly.' },
      { status: 502 }
    );
  }

  let data: Record<string, unknown>;
  try {
    data = await upstream.json();
  } catch (err) {
    console.error('Preview invitation route: upstream response was not valid JSON', err);
    return NextResponse.json({ message: 'The server returned an unexpected response.' }, { status: 502 });
  }

  return NextResponse.json(data, { status: upstream.status });
}

import { NextResponse } from 'next/server';
import { API_BASE_URL } from '../../../../../lib/auth-cookies';

/**
 * Proxies the public POST /v1/guardian-invitations/decline directly --
 * not through apiFetch, matching the accept route right next to this
 * one: whoever is declining a guardian invitation hasn't necessarily
 * ever logged in at all, so apiFetch's session requirement would
 * reject this exact case immediately.
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
    upstream = await fetch(`${API_BASE_URL}/v1/guardian-invitations/decline`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (err) {
    console.error('Decline invitation route: failed to reach upstream API', API_BASE_URL, err);
    return NextResponse.json(
      { message: 'Could not reach the server. Please try again shortly.' },
      { status: 502 }
    );
  }

  let data: Record<string, unknown>;
  try {
    data = await upstream.json();
  } catch (err) {
    console.error('Decline invitation route: upstream response was not valid JSON', err);
    return NextResponse.json({ message: 'The server returned an unexpected response.' }, { status: 502 });
  }

  return NextResponse.json(data, { status: upstream.status });
}

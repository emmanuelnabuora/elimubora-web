import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '../../../../lib/api-client';

/** Proxies POST /v1/class-streams. A real, previously-missing gap:
 *  no frontend form existed anywhere to create one, meaning any newly
 *  onboarded school had no path to enrolling a single student. */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Malformed request body.' }, { status: 400 });
  }
  try {
    const stream = await apiFetch('/v1/class-streams', { method: 'POST', body: JSON.stringify(body) });
    return NextResponse.json(stream, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error('Class streams route: unexpected error', err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 502 });
  }
}

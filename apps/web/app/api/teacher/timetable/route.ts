import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '../../../../lib/api-client';

/** Proxies POST /v1/timetable for a teacher creating their own slot.
 *  The backend enforces that a non-admin caller can only create a
 *  slot where teacherId matches their own user id — this route does
 *  no role-specific logic itself, same as the admin one, since that
 *  check genuinely belongs server-side. */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Malformed request body.' }, { status: 400 });
  }

  try {
    const slot = await apiFetch('/v1/timetable', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return NextResponse.json(slot, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error('Teacher timetable route: unexpected error', err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 502 });
  }
}

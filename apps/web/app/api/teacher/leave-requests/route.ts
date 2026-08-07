import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '../../../../lib/api-client';
import { getCurrentUser } from '../../../../lib/get-current-user';

/** Proxies GET /v1/leave-requests/staff/:staffId (the caller's own) and POST /v1/leave-requests (submit). */
export async function GET(): Promise<NextResponse> {
  const result = await getCurrentUser();
  if (!result) return NextResponse.json({ message: 'Not signed in' }, { status: 401 });
  try {
    const requests = await apiFetch(`/v1/leave-requests/staff/${result.user.id}`);
    return NextResponse.json(requests);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error('Leave requests route: unexpected error', err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 502 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Malformed request body.' }, { status: 400 });
  }
  try {
    const result = await apiFetch('/v1/leave-requests', { method: 'POST', body: JSON.stringify(body) });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error('Leave requests route: unexpected error', err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 502 });
  }
}

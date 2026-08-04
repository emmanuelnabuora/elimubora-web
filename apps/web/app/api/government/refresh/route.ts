import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '../../../../lib/api-client';

/** Proxies both POST /v1/gov/enrollment/refresh and POST /v1/gov/attendance/refresh as one action. */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Malformed request body.' }, { status: 400 });
  }
  try {
    await apiFetch('/v1/gov/enrollment/refresh', { method: 'POST', body: JSON.stringify(body) });
    await apiFetch('/v1/gov/attendance/refresh', { method: 'POST', body: JSON.stringify(body) });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error('Government refresh route: unexpected error', err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 502 });
  }
}

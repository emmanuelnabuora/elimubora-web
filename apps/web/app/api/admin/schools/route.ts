import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '../../../../lib/api-client';

/** Proxies GET /v1/tenants/schools — for picking a transfer destination. */
export async function GET(): Promise<NextResponse> {
  try {
    const schools = await apiFetch('/v1/tenants/schools');
    return NextResponse.json(schools);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error('Schools route: unexpected error', err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 502 });
  }
}

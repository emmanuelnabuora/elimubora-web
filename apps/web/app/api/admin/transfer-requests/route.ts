import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '../../../../lib/api-client';

/** Proxies GET /v1/transfer-requests — for staff, every request at the school. */
export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json(await apiFetch('/v1/transfer-requests'));
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error('Transfer requests route: unexpected error', err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 502 });
  }
}

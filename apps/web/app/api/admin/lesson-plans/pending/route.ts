import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '../../../../../lib/api-client';

/** Proxies GET /v1/lesson-plans/pending — every submitted plan awaiting admin approval, across all courses/teachers. */
export async function GET(): Promise<NextResponse> {
  try {
    const plans = await apiFetch('/v1/lesson-plans/pending');
    return NextResponse.json(plans);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error('Pending lesson plans route: unexpected error', err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 502 });
  }
}

import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '../../../../../lib/api-client';

/** Proxies GET /v1/exams/mine — a learner's own exam list, enriched with their own attempt status per exam. */
export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json(await apiFetch('/v1/exams/mine'));
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error('My exams route: unexpected error', err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 502 });
  }
}

import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '../../../../../../lib/api-client';

/** Proxies POST /v1/exams/:id/attempts (start an attempt, learner-only). */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ examId: string }> }
): Promise<NextResponse> {
  const { examId } = await params;
  try {
    const result = await apiFetch(`/v1/exams/${examId}/attempts`, { method: 'POST', body: '{}' });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error('Start attempt route: unexpected error', err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 502 });
  }
}

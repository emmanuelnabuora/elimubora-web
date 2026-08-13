import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '../../../../../../lib/api-client';

/** Proxies GET /v1/exam-attempts/:id/review — the full question set including the answer key, for grading. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
): Promise<NextResponse> {
  const { attemptId } = await params;
  try {
    const review = await apiFetch(`/v1/exam-attempts/${attemptId}/review`);
    return NextResponse.json(review);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error('Exam attempt review route: unexpected error', err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 502 });
  }
}

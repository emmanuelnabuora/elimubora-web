import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '../../../../../../lib/api-client';

/** Proxies GET /v1/exam-attempts/:id/questions — the answer-key-free view a learner sits with. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
): Promise<NextResponse> {
  const { attemptId } = await params;
  try {
    return NextResponse.json(await apiFetch(`/v1/exam-attempts/${attemptId}/questions`));
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error('Attempt questions route: unexpected error', err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 502 });
  }
}

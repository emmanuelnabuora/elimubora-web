import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '../../../../../../lib/api-client';

/** Proxies PATCH /v1/question-banks/questions/:questionId/review. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ questionId: string }> }
): Promise<NextResponse> {
  const { questionId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Malformed request body.' }, { status: 400 });
  }
  try {
    const result = await apiFetch(`/v1/question-banks/questions/${questionId}/review`, { method: 'PATCH', body: JSON.stringify(body) });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error('Review question route: unexpected error', err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 502 });
  }
}

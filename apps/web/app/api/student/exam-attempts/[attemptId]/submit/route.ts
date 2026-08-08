import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '../../../../../../lib/api-client';

/** Proxies POST /v1/exam-attempts/:id/submit. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
): Promise<NextResponse> {
  const { attemptId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Malformed request body.' }, { status: 400 });
  }
  try {
    const result = await apiFetch(`/v1/exam-attempts/${attemptId}/submit`, { method: 'POST', body: JSON.stringify(body) });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error('Submit attempt route: unexpected error', err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 502 });
  }
}

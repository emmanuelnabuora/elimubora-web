import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '../../../../../../lib/api-client';

/** Proxies GET /v1/exams/:id/attempts (list, staff-only). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ examId: string }> }
): Promise<NextResponse> {
  const { examId } = await params;
  try {
    return NextResponse.json(await apiFetch(`/v1/exams/${examId}/attempts`));
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error('Exam attempts route: unexpected error', err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 502 });
  }
}

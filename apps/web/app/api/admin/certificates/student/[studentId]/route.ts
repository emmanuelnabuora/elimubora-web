import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '../../../../../../lib/api-client';

/** Proxies GET /v1/certificates/student/:studentId. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studentId: string }> }
): Promise<NextResponse> {
  const { studentId } = await params;
  try {
    return NextResponse.json(await apiFetch(`/v1/certificates/student/${studentId}`));
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error('Student certificates route: unexpected error', err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 502 });
  }
}

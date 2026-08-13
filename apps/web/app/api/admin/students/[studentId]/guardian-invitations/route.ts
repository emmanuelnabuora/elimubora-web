import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '../../../../../../lib/api-client';

/** Proxies POST /v1/students/:studentId/guardian-invitations — inviting a guardian with a real account-creation link. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> }
): Promise<NextResponse> {
  const { studentId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Malformed request body.' }, { status: 400 });
  }
  try {
    const result = await apiFetch(`/v1/students/${studentId}/guardian-invitations`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error('Guardian invitation route: unexpected error', err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 502 });
  }
}

import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '../../../../../../lib/api-client';

/** Proxies POST /v1/library/resources/:id/access — logs a real viewed/downloaded event. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Malformed request body.' }, { status: 400 });
  }
  try {
    const result = await apiFetch(`/v1/library/resources/${id}/access`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    // recordAccess returns void server-side, so apiFetch correctly
    // resolves to undefined here — but NextResponse.json(undefined)
    // itself throws ("Value is not JSON serializable"), a second real
    // bug found by the same live test as the apiFetch empty-body fix.
    return NextResponse.json(result ?? { ok: true }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error('Library access route: unexpected error', err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 502 });
  }
}

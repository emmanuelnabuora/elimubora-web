import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '../../../../../../lib/api-client';

/** Proxies PATCH /v1/guardians/:id/link-account — linking an already-existing,
 *  previously-unlinked guardian to a portal account after the fact. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ guardianId: string }> }
): Promise<NextResponse> {
  const { guardianId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Malformed request body.' }, { status: 400 });
  }
  try {
    // linkGuardianAccount returns void on success (empty response body),
    // and NextResponse.json(undefined) throws -- the same bug found and
    // fixed for the library-access route earlier in this project, missed
    // here until this route was actually exercised end to end.
    const guardian = await apiFetch(`/v1/guardians/${guardianId}/link-account`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
    return NextResponse.json(guardian ?? { ok: true });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error('Guardian link-account route: unexpected error', err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 502 });
  }
}

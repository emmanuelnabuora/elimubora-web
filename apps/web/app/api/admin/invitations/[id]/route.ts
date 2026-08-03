import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '../../../../../lib/api-client';

/** Proxies DELETE /v1/users/invitations/:id — revoking a pending invitation. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  try {
    await apiFetch(`/v1/users/invitations/${id}`, { method: 'DELETE' });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error('Invitation revoke route: unexpected error', err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 502 });
  }
}

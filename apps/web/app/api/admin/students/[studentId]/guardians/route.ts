import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '../../../../../../lib/api-client';

/**
 * Orchestrates the real 2-3 step backend flow as one admin action:
 * 1. POST /v1/guardians -- create the guardian record
 * 2. POST /v1/students/:id/guardians -- link it to this student
 * 3. PATCH /v1/guardians/:id/link-account -- optionally link an
 *    existing parent-role user account, so that account's portal
 *    login actually sees this child. Skipped if no account is chosen.
 *
 * Each step is real and independently meaningful (a guardian record
 * can exist without portal access, e.g., a grandparent who only picks
 * up but never logs in) -- this route just saves the admin three
 * separate manual round-trips for the common case of doing all three
 * at once.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> }
): Promise<NextResponse> {
  const { studentId } = await params;
  let body: {
    fullName: string;
    phone?: string;
    email?: string;
    nationalId?: string;
    relationship: string;
    isPrimary: boolean;
    canPickup: boolean;
    linkToUserId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Malformed request body.' }, { status: 400 });
  }

  try {
    const guardian = await apiFetch<{ id: string; fullName: string }>('/v1/guardians', {
      method: 'POST',
      body: JSON.stringify({
        fullName: body.fullName,
        phone: body.phone || undefined,
        email: body.email || undefined,
        nationalId: body.nationalId || undefined
      })
    });

    await apiFetch(`/v1/students/${studentId}/guardians`, {
      method: 'POST',
      body: JSON.stringify({
        guardianId: guardian.id,
        relationship: body.relationship,
        isPrimary: body.isPrimary,
        canPickup: body.canPickup
      })
    });

    if (body.linkToUserId) {
      await apiFetch(`/v1/guardians/${guardian.id}/link-account`, {
        method: 'PATCH',
        body: JSON.stringify({ userId: body.linkToUserId })
      });
    }

    return NextResponse.json({ id: guardian.id, fullName: guardian.fullName }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error('Guardian orchestration route: unexpected error', err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 502 });
  }
}

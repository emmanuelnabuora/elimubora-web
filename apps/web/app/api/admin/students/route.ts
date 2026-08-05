import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '../../../../lib/api-client';

/**
 * Proxies POST /v1/students (student enrollment), optionally
 * orchestrating a parent/guardian setup in the same action when
 * parentFullName + parentEmail are provided: creates the guardian
 * record (now including physicalAddress, a real field added for this
 * feature), links them to the just-enrolled student as primary, and
 * sends a real invitation (role: parent) so that parent gets a
 * working portal account — the same invitation mechanism already used
 * for staff, not a separate one invented here.
 *
 * The student enrollment itself is NOT undone if the parent steps
 * fail afterward — it's a real, separate database write by that
 * point, not something this route can roll back. Rather than report
 * a blanket failure (which could tempt a retry and create a second,
 * duplicate student), a partial failure here returns the successfully
 * created student with a parentWarning field explaining what didn't
 * complete, so the admin can retry just the guardian step from the
 * student's own detail page instead.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: {
    fullName: string;
    dateOfBirth?: string;
    address?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    gradeLevel: string;
    classStreamId?: string;
    academicYear: number;
    parentFullName?: string;
    parentEmail?: string;
    parentPhysicalAddress?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Malformed request body.' }, { status: 400 });
  }

  let student: Record<string, unknown>;
  try {
    student = await apiFetch('/v1/students', {
      method: 'POST',
      body: JSON.stringify({
        fullName: body.fullName,
        dateOfBirth: body.dateOfBirth,
        address: body.address,
        emergencyContactName: body.emergencyContactName,
        emergencyContactPhone: body.emergencyContactPhone,
        gradeLevel: body.gradeLevel,
        classStreamId: body.classStreamId,
        academicYear: body.academicYear
      })
    });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error('Admin students route: unexpected error enrolling student', err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 502 });
  }

  // Parent setup is entirely optional — most enrollments proceed
  // without it, matching the existing add-guardian-later flow.
  if (!body.parentFullName || !body.parentEmail) {
    return NextResponse.json(student, { status: 201 });
  }

  try {
    const guardian = await apiFetch<{ id: string }>('/v1/guardians', {
      method: 'POST',
      body: JSON.stringify({
        fullName: body.parentFullName,
        email: body.parentEmail,
        physicalAddress: body.parentPhysicalAddress || undefined
      })
    });
    await apiFetch(`/v1/students/${student.studentId}/guardians`, {
      method: 'POST',
      body: JSON.stringify({ guardianId: guardian.id, relationship: 'Parent/Guardian', isPrimary: true, canPickup: true })
    });
    await apiFetch('/v1/users/invitations', {
      method: 'POST',
      body: JSON.stringify({ email: body.parentEmail, role: 'parent' })
    });
    return NextResponse.json(student, { status: 201 });
  } catch (err) {
    const message = err instanceof ApiError ? err.message : 'Something went wrong setting up the parent account.';
    console.error('Admin students route: student enrolled, but parent setup failed', err);
    return NextResponse.json(
      { ...student, parentWarning: `Student enrolled, but the parent could not be set up: ${message}` },
      { status: 201 }
    );
  }
}

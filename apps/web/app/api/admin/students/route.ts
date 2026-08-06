import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '../../../../lib/api-client';

/**
 * Proxies POST /v1/students (student enrollment), optionally
 * orchestrating one or two parent/guardian setups in the same action
 * when parentFullName + parentEmail (and, separately,
 * parent2FullName + parent2Email) are provided: creates each
 * guardian record, links them to the just-enrolled student, and
 * sends a real invitation (role: parent) so each parent gets a
 * working portal account — the same invitation mechanism already used
 * for staff, not a separate one invented here.
 *
 * This whole flow is deliberately separate from the existing
 * "link an existing guardian to a student after the fact" feature
 * (LinkGuardianAccountAction on the student detail page) -- that
 * stays exactly as it was, for guardians who already have a record
 * elsewhere in the system. This is only for creating brand new
 * guardian records as part of enrollment itself.
 *
 * The student enrollment itself is NOT undone if a parent setup fails
 * afterward — it's a real, separate database write by that point, not
 * something this route can roll back. Rather than report a blanket
 * failure (which could tempt a retry and create a second, duplicate
 * student), a partial failure here returns the successfully created
 * student with a parentWarning field explaining what didn't complete,
 * so the admin can retry just the guardian step from the student's
 * own detail page instead. If both parents are provided and only one
 * fails, the warning says which one specifically -- the other parent
 * is still successfully set up either way.
 */

interface ParentInput {
  fullName: string;
  email: string;
  physicalAddress?: string;
}

async function setUpParent(studentId: string, parent: ParentInput, isPrimary: boolean): Promise<void> {
  const guardian = await apiFetch<{ id: string }>('/v1/guardians', {
    method: 'POST',
    body: JSON.stringify({
      fullName: parent.fullName,
      email: parent.email,
      physicalAddress: parent.physicalAddress || undefined
    })
  });
  await apiFetch(`/v1/students/${studentId}/guardians`, {
    method: 'POST',
    body: JSON.stringify({ guardianId: guardian.id, relationship: 'Parent/Guardian', isPrimary, canPickup: true })
  });
  await apiFetch('/v1/users/invitations', {
    method: 'POST',
    body: JSON.stringify({ email: parent.email, role: 'parent' })
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: {
    fullName: string;
    dateOfBirth?: string;
    gender?: 'male' | 'female';
    address?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    gradeLevel: string;
    classStreamId?: string;
    academicYear: number;
    applicationId?: string;
    parentFullName?: string;
    parentEmail?: string;
    parentPhysicalAddress?: string;
    parent2FullName?: string;
    parent2Email?: string;
    parent2PhysicalAddress?: string;
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
        gender: body.gender,
        address: body.address,
        emergencyContactName: body.emergencyContactName,
        emergencyContactPhone: body.emergencyContactPhone,
        gradeLevel: body.gradeLevel,
        classStreamId: body.classStreamId,
        academicYear: body.academicYear,
        applicationId: body.applicationId
      })
    });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error('Admin students route: unexpected error enrolling student', err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 502 });
  }

  const parents: Array<{ label: string; input: ParentInput }> = [];
  if (body.parentFullName && body.parentEmail) {
    parents.push({
      label: body.parentFullName,
      input: { fullName: body.parentFullName, email: body.parentEmail, physicalAddress: body.parentPhysicalAddress }
    });
  }
  if (body.parent2FullName && body.parent2Email) {
    parents.push({
      label: body.parent2FullName,
      input: { fullName: body.parent2FullName, email: body.parent2Email, physicalAddress: body.parent2PhysicalAddress }
    });
  }

  // Parent setup is entirely optional — most enrollments proceed
  // without it, matching the existing add-guardian-later flow.
  if (parents.length === 0) {
    return NextResponse.json(student, { status: 201 });
  }

  const failures: string[] = [];
  for (const [index, parent] of parents.entries()) {
    try {
      await setUpParent(student.studentId as string, parent.input, index === 0);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'something went wrong setting up their account';
      console.error(`Admin students route: student enrolled, but parent setup failed for ${parent.label}`, err);
      failures.push(`${parent.label} (${message})`);
    }
  }

  if (failures.length > 0) {
    return NextResponse.json(
      { ...student, parentWarning: `Student enrolled, but this could not be set up: ${failures.join('; ')}` },
      { status: 201 }
    );
  }
  return NextResponse.json(student, { status: 201 });
}

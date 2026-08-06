import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '../../../../../lib/api-client';

/**
 * Bulk student enrollment from CSV rows -- a roster import. Expected
 * columns: fullName, gradeLevel, dateOfBirth (optional), gender
 * (optional, male/female). academicYear isn't a CSV column: an
 * entire roster import is almost always for the current year, so it
 * defaults the same way the regular single-student enrollment form's
 * academic year field already does (current year, not user-editable)
 * rather than asking for it per row.
 *
 * classStreamId is deliberately never set here -- every imported
 * student goes through the same auto-assign-to-least-populated-stream
 * path that POST /v1/students already uses when classStreamId is
 * omitted, so a roster import doesn't require the CSV to know
 * specific class stream IDs at all.
 *
 * No parent/guardian setup here -- that stays a per-student, one-at-
 * a-time action (either at individual enrollment or via the existing
 * link-guardian-after-the-fact feature), not something a roster CSV
 * attempts in bulk.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: { rows: Array<Record<string, string>> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Malformed request body.' }, { status: 400 });
  }

  const academicYear = new Date().getFullYear();
  let created = 0;
  const failed: Array<{ row: number; message: string }> = [];

  for (let i = 0; i < body.rows.length; i++) {
    const row = body.rows[i]!;
    const fullName = row.fullName ?? row.full_name ?? row['Full Name'];
    const gradeLevel = row.gradeLevel ?? row.grade_level ?? row['Grade Level'];
    const dateOfBirth = row.dateOfBirth ?? row.date_of_birth ?? row['Date of Birth'];
    const genderRaw = (row.gender ?? row.Gender ?? '').toLowerCase();
    const gender = genderRaw === 'male' || genderRaw === 'female' ? genderRaw : undefined;

    if (!fullName || !gradeLevel) {
      failed.push({ row: i + 2, message: 'missing fullName or gradeLevel' });
      continue;
    }
    try {
      await apiFetch('/v1/students', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          gradeLevel,
          dateOfBirth: dateOfBirth || undefined,
          gender,
          academicYear
        })
      });
      created += 1;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'something went wrong enrolling this student';
      failed.push({ row: i + 2, message });
    }
  }

  return NextResponse.json({ created, failed });
}

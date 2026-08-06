import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '../../../../../lib/api-client';

/**
 * Bulk class stream creation from CSV rows. Expected columns: name,
 * gradeLevel, academicYear. Same per-row loop pattern as the course
 * import -- reuses the existing single-create endpoint and its
 * validation/duplicate-name handling per row.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: { rows: Array<Record<string, string>> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Malformed request body.' }, { status: 400 });
  }

  let created = 0;
  const failed: Array<{ row: number; message: string }> = [];

  for (let i = 0; i < body.rows.length; i++) {
    const row = body.rows[i]!;
    const name = row.name ?? row.Name;
    const gradeLevel = row.gradeLevel ?? row.grade_level ?? row['Grade Level'];
    const academicYearRaw = row.academicYear ?? row.academic_year ?? row['Academic Year'];
    const academicYear = Number(academicYearRaw);

    if (!name || !gradeLevel || !academicYearRaw || Number.isNaN(academicYear)) {
      failed.push({ row: i + 2, message: 'missing or invalid name, gradeLevel, or academicYear' });
      continue;
    }
    try {
      await apiFetch('/v1/class-streams', {
        method: 'POST',
        body: JSON.stringify({ name, gradeLevel, academicYear })
      });
      created += 1;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'something went wrong creating this class';
      failed.push({ row: i + 2, message });
    }
  }

  return NextResponse.json({ created, failed });
}

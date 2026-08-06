import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '../../../../../lib/api-client';

/**
 * Bulk course creation from CSV rows. Expected columns: title,
 * learningArea, gradeLevel, description (optional). Loops individual
 * POST /v1/courses calls rather than a new bulk backend endpoint --
 * reuses the already-tested single-create validation and error
 * handling per row, and a partial failure (one bad row) doesn't
 * abandon the rows that were fine.
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
    const title = row.title ?? row.Title;
    const learningArea = row.learningArea ?? row.learning_area ?? row['Learning Area'];
    const gradeLevel = row.gradeLevel ?? row.grade_level ?? row['Grade Level'];
    const description = row.description ?? row.Description;

    if (!title || !learningArea || !gradeLevel) {
      failed.push({ row: i + 2, message: 'missing title, learningArea, or gradeLevel' });
      continue;
    }
    try {
      await apiFetch('/v1/courses', {
        method: 'POST',
        body: JSON.stringify({ title, learningArea, gradeLevel, description: description || undefined })
      });
      created += 1;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'something went wrong creating this course';
      failed.push({ row: i + 2, message });
    }
  }

  return NextResponse.json({ created, failed });
}

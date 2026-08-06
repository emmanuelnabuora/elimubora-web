import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '../../../../../lib/api-client';

/**
 * Creates a set of "common" subjects (e.g. English, Mathematics,
 * Science, Geography) as real courses across every selected grade
 * level in one action -- the alternative to creating "English G1",
 * "English G2", "English G3"... one at a time through the regular
 * create-course form.
 *
 * Fetches existing courses first and skips any (title, gradeLevel)
 * combination that already exists (case-insensitive) rather than
 * creating a duplicate -- there's no database constraint stopping
 * duplicate courses, so this is the only thing preventing a second
 * "English G1" if a subject was already set up manually or from a
 * previous bulk-common run.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: { subjects: string[]; gradeLevels: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Malformed request body.' }, { status: 400 });
  }

  const subjects = (body.subjects ?? []).map((s) => s.trim()).filter(Boolean);
  const gradeLevels = body.gradeLevels ?? [];
  if (subjects.length === 0 || gradeLevels.length === 0) {
    return NextResponse.json({ message: 'Select at least one subject and one grade level.' }, { status: 400 });
  }

  let existing: Array<{ title: string; gradeLevel: string }>;
  try {
    existing = await apiFetch('/v1/courses');
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ message: err.message }, { status: err.status });
    return NextResponse.json({ message: 'Could not check existing courses. Try again.' }, { status: 502 });
  }
  const existingKeys = new Set(existing.map((c) => `${c.title.toLowerCase()}|${c.gradeLevel}`));

  let created = 0;
  let skipped = 0;
  const failed: Array<{ subject: string; gradeLevel: string; message: string }> = [];

  for (const subject of subjects) {
    for (const gradeLevel of gradeLevels) {
      const key = `${subject.toLowerCase()}|${gradeLevel}`;
      if (existingKeys.has(key)) {
        skipped += 1;
        continue;
      }
      try {
        await apiFetch('/v1/courses', {
          method: 'POST',
          body: JSON.stringify({ title: subject, learningArea: subject, gradeLevel })
        });
        created += 1;
        existingKeys.add(key); // guards against duplicate rows within the same request
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'something went wrong';
        failed.push({ subject, gradeLevel, message });
      }
    }
  }

  return NextResponse.json({ created, skipped, failed });
}

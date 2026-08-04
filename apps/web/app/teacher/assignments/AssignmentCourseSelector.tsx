'use client';

import { useRouter } from 'next/navigation';

interface Course {
  courseId: string;
  title: string;
}

export function AssignmentCourseSelector({ courses, selected }: { courses: Course[]; selected?: string }) {
  const router = useRouter();

  return (
    <label className="admin-field" style={{ maxWidth: 320 }}>
      <span>Course</span>
      <select
        value={selected ?? ''}
        onChange={(e) => {
          const id = e.target.value;
          router.push(id ? `/teacher/assignments?courseId=${id}` : '/teacher/assignments');
        }}
      >
        <option value="">Select a course…</option>
        {courses.map((c) => (
          <option key={c.courseId} value={c.courseId}>
            {c.title}
          </option>
        ))}
      </select>
    </label>
  );
}

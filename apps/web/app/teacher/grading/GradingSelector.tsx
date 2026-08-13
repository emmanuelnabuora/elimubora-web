'use client';

import { useRouter } from 'next/navigation';

interface CourseSummary {
  courseId: string;
  title: string;
}

interface Assignment {
  id: string;
  title: string;
}

interface ExamSummary {
  id: string;
  title: string;
}

export function GradingSelector({
  courses,
  assignments,
  exams,
  selectedCourseId,
  selectedAssignmentId,
  selectedExamId
}: {
  courses: CourseSummary[];
  assignments: Assignment[];
  exams: ExamSummary[];
  selectedCourseId?: string;
  selectedAssignmentId?: string;
  selectedExamId?: string;
}) {
  const router = useRouter();

  return (
    <div className="admin-form-row">
      <label className="admin-field">
        <span>Course</span>
        <select
          value={selectedCourseId ?? ''}
          onChange={(e) => {
            const id = e.target.value;
            router.push(id ? `/teacher/grading?courseId=${id}` : '/teacher/grading');
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
      {selectedCourseId && (
        <label className="admin-field">
          <span>Assignment</span>
          <select
            value={selectedAssignmentId ?? ''}
            onChange={(e) => {
              const id = e.target.value;
              router.push(
                id
                  ? `/teacher/grading?courseId=${selectedCourseId}&assignmentId=${id}`
                  : `/teacher/grading?courseId=${selectedCourseId}`
              );
            }}
          >
            <option value="">Select an assignment…</option>
            {assignments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        </label>
      )}
      {selectedCourseId && (
        <label className="admin-field">
          <span>Exam</span>
          <select
            value={selectedExamId ?? ''}
            onChange={(e) => {
              const id = e.target.value;
              router.push(
                id
                  ? `/teacher/grading?courseId=${selectedCourseId}&examId=${id}`
                  : `/teacher/grading?courseId=${selectedCourseId}`
              );
            }}
          >
            <option value="">Select an exam…</option>
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

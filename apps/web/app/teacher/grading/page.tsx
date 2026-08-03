import { apiFetch } from '../../../lib/api-client';
import { CourseAssignmentSelector } from './CourseAssignmentSelector';
import { SubmissionsGrader } from './SubmissionsGrader';

interface CourseSummary {
  courseId: string;
  title: string;
}

interface Assignment {
  id: string;
  title: string;
  maxScore: string;
}

interface Submission {
  id: string;
  learnerId: string;
  status: string;
  submittedAt: string;
  score: string | null;
  feedback: string | null;
}

interface StudentListItem {
  studentId: string;
  fullName: string;
}

export default async function GradingPage({
  searchParams
}: {
  searchParams: Promise<{ courseId?: string; assignmentId?: string }>;
}) {
  const { courseId, assignmentId } = await searchParams;

  const [dashboard, students] = await Promise.all([
    apiFetch<{ courses: CourseSummary[] }>('/v1/teacher/dashboard'),
    apiFetch<StudentListItem[]>('/v1/students')
  ]);

  const assignments = courseId ? await apiFetch<Assignment[]>(`/v1/courses/${courseId}/assignments`) : [];

  const submissions = assignmentId
    ? await apiFetch<Submission[]>(`/v1/assignments/${assignmentId}/submissions`)
    : [];

  const selectedAssignment = assignments.find((a) => a.id === assignmentId);
  const studentName = (id: string) => students.find((s) => s.studentId === id)?.fullName ?? id;

  return (
    <div>
      <h1 className="admin-page-title">Grading</h1>

      <div className="admin-section">
        <CourseAssignmentSelector
          courses={dashboard.courses}
          assignments={assignments}
          selectedCourseId={courseId}
          selectedAssignmentId={assignmentId}
        />

        {assignmentId && selectedAssignment && (
          <div style={{ marginTop: 'var(--eb-space-4)' }}>
            {submissions.length === 0 ? (
              <p className="admin-empty">No submissions yet for this assignment.</p>
            ) : (
              <SubmissionsGrader
                maxScore={Number(selectedAssignment.maxScore)}
                submissions={submissions.map((s) => ({
                  id: s.id,
                  learnerName: studentName(s.learnerId),
                  status: s.status,
                  score: s.score,
                  feedback: s.feedback
                }))}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

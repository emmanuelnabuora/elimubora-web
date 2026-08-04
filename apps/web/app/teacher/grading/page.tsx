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

interface RosterEntry {
  userId: string;
  courseRole: string;
  fullName: string;
}

export default async function GradingPage({
  searchParams
}: {
  searchParams: Promise<{ courseId?: string; assignmentId?: string }>;
}) {
  const { courseId, assignmentId } = await searchParams;

  const dashboard = await apiFetch<{ courses: CourseSummary[] }>('/v1/teacher/dashboard');

  const assignments = courseId ? await apiFetch<Assignment[]>(`/v1/courses/${courseId}/assignments`) : [];
  // Real bug fixed here: this used to call the admin-only
  // GET /students to resolve names, which throws a 403 for any real
  // (non-admin) teacher account and crashed the whole page (it ran
  // inside the same Promise.all as everything else). The roster
  // endpoint every teacher can already call now includes fullName —
  // see learning.repository.ts's listRosterForCourse for the actual
  // fix. Fetched per-course rather than once, since roster is
  // naturally course-scoped.
  const roster = courseId ? await apiFetch<RosterEntry[]>(`/v1/courses/${courseId}/roster`) : [];

  const submissions = assignmentId
    ? await apiFetch<Submission[]>(`/v1/assignments/${assignmentId}/submissions`)
    : [];

  const selectedAssignment = assignments.find((a) => a.id === assignmentId);
  const studentName = (id: string) => roster.find((r) => r.userId === id)?.fullName ?? id;

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

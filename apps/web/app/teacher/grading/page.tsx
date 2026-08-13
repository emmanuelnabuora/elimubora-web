import { apiFetch } from '../../../lib/api-client';
import { GradingSelector } from './GradingSelector';
import { SubmissionsGrader } from './SubmissionsGrader';
import { ExamAttemptsList } from './ExamAttemptsList';

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

interface ExamSummary {
  id: string;
  courseId: string;
  title: string;
  status: string;
}

interface ExamAttemptSummary {
  id: string;
  learnerName: string | null;
  status: string;
  autoScore: string;
  manualScore: string;
  finalScore: string;
}

export default async function GradingPage({
  searchParams
}: {
  searchParams: Promise<{ courseId?: string; assignmentId?: string; examId?: string }>;
}) {
  const { courseId, assignmentId, examId } = await searchParams;

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

  // listExams isn't course-scoped server-side (it returns every exam
  // in the tenant), so the course filter happens here rather than
  // adding a new backend endpoint for what's a simple client-side filter.
  const allExams = courseId ? await apiFetch<ExamSummary[]>('/v1/exams') : [];
  const exams = allExams.filter((e) => e.courseId === courseId);

  const attempts = examId ? await apiFetch<ExamAttemptSummary[]>(`/v1/exams/${examId}/attempts`) : [];

  const selectedAssignment = assignments.find((a) => a.id === assignmentId);
  const studentName = (id: string) => roster.find((r) => r.userId === id)?.fullName ?? id;

  return (
    <div>
      <h1 className="admin-page-title">Grading</h1>

      <div className="admin-section">
        <GradingSelector
          courses={dashboard.courses}
          assignments={assignments}
          exams={exams}
          selectedCourseId={courseId}
          selectedAssignmentId={assignmentId}
          selectedExamId={examId}
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

        {examId && (
          <div style={{ marginTop: 'var(--eb-space-4)' }}>
            <ExamAttemptsList attempts={attempts} />
          </div>
        )}
      </div>
    </div>
  );
}

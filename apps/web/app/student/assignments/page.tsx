import { apiFetch, ApiError } from '../../../lib/api-client';
import { CourseSelector } from './CourseSelector';
import { SubmitForm } from './SubmitForm';

interface Course {
  id: string;
  title: string;
}

interface Assignment {
  id: string;
  title: string;
  instructions: string | null;
  dueAt: string | null;
  maxScore: string;
}

interface Submission {
  id: string;
  status: string;
  score: string | null;
  feedback: string | null;
  gradedAt: string | null;
}

async function fetchMySubmission(assignmentId: string): Promise<Submission | null> {
  try {
    return await apiFetch<Submission>(`/v1/assignments/${assignmentId}/submissions/me`);
  } catch (err) {
    // No submission yet is an expected, common state (the API returns
    // a real 404, not a null) — not an error condition for this page.
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

interface RecentGrade {
  courseTitle: string;
  assignmentTitle: string;
  score: string;
  maxScore: string;
  gradedAt: string;
}

async function fetchRecentGrades(courses: Course[]): Promise<RecentGrade[]> {
  const perCourse = await Promise.all(
    courses.map(async (course) => {
      const assignments = await apiFetch<Assignment[]>(`/v1/courses/${course.id}/assignments`);
      const submissions = await Promise.all(assignments.map((a) => fetchMySubmission(a.id)));
      const graded: RecentGrade[] = [];
      assignments.forEach((a, i) => {
        const sub = submissions[i];
        if (sub && sub.status === 'graded' && sub.score !== null && sub.gradedAt) {
          graded.push({
            courseTitle: course.title,
            assignmentTitle: a.title,
            score: sub.score,
            maxScore: a.maxScore,
            gradedAt: sub.gradedAt
          });
        }
      });
      return graded;
    })
  );
  return perCourse
    .flat()
    .sort((a, b) => b.gradedAt.localeCompare(a.gradedAt))
    .slice(0, 10);
}

export default async function AssignmentsPage({
  searchParams
}: {
  searchParams: Promise<{ courseId?: string }>;
}) {
  const { courseId } = await searchParams;

  const courses = await apiFetch<Course[]>('/v1/courses/mine');
  const [assignments, recentGrades] = await Promise.all([
    courseId ? apiFetch<Assignment[]>(`/v1/courses/${courseId}/assignments`) : Promise.resolve([]),
    fetchRecentGrades(courses)
  ]);
  const submissions = await Promise.all(assignments.map((a) => fetchMySubmission(a.id)));

  return (
    <div>
      <h1 className="admin-page-title">Assignments</h1>

      {recentGrades.length > 0 && (
        <div className="admin-section">
          <h2 className="admin-section-title">Recent grades</h2>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
            {recentGrades.map((g, i) => (
              <div
                key={i}
                style={{
                  flex: '0 0 auto',
                  minWidth: 160,
                  border: '1px solid var(--eb-line)',
                  borderRadius: 'var(--eb-radius-sm)',
                  padding: 12,
                  background: 'var(--eb-green-100)'
                }}
              >
                <p style={{ fontSize: 12, color: 'var(--eb-fg-muted)', margin: '0 0 4px' }}>{g.courseTitle}</p>
                <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 6px' }}>{g.assignmentTitle}</p>
                <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                  {g.score} <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--eb-fg-muted)' }}>/ {g.maxScore}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="admin-section">
        <CourseSelector courses={courses} selected={courseId} />

        {courseId &&
          (assignments.length === 0 ? (
            <p className="admin-empty" style={{ marginTop: 'var(--eb-space-4)' }}>
              No assignments in this course yet.
            </p>
          ) : (
            <div style={{ marginTop: 'var(--eb-space-4)', display: 'grid', gap: 'var(--eb-space-4)' }}>
              {assignments.map((a, i) => {
                const submission = submissions[i];
                return (
                  <div key={a.id} className="admin-section" style={{ margin: 0 }}>
                    <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700 }}>{a.title}</h3>
                    {a.instructions && (
                      <p style={{ fontSize: 14, color: 'var(--eb-fg-muted)', margin: '0 0 8px' }}>
                        {a.instructions}
                      </p>
                    )}
                    <p style={{ fontSize: 13, color: 'var(--eb-fg-muted)', margin: '0 0 12px' }}>
                      {a.dueAt ? `Due ${new Date(a.dueAt).toLocaleDateString()}` : 'No due date'} &middot; Max score{' '}
                      {a.maxScore}
                    </p>

                    {!submission ? (
                      <SubmitForm assignmentId={a.id} />
                    ) : submission.status === 'graded' ? (
                      <div>
                        <span className="status-pill active">
                          Graded: {submission.score} / {a.maxScore}
                        </span>
                        {submission.feedback && <p style={{ fontSize: 14, marginTop: 8 }}>{submission.feedback}</p>}
                      </div>
                    ) : (
                      <span className="status-pill pending">Submitted — awaiting grading</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
      </div>
    </div>
  );
}

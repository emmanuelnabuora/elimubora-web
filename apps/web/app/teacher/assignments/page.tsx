import { apiFetch } from '../../../lib/api-client';
import { AssignmentCourseSelector } from './AssignmentCourseSelector';
import { CreateAssignmentForm } from './CreateAssignmentForm';
import { ClassPerformanceChart } from './ClassPerformanceChart';

interface CourseSummary {
  courseId: string;
  title: string;
}

interface Assignment {
  id: string;
  title: string;
  dueAt: string | null;
  maxScore: string;
}

interface Submission {
  id: string;
  status: string;
  score: string | null;
  gradedAt: string | null;
}

export default async function AssignmentsPage({
  searchParams
}: {
  searchParams: Promise<{ courseId?: string }>;
}) {
  const { courseId } = await searchParams;

  const dashboard = await apiFetch<{ courses: CourseSummary[] }>('/v1/teacher/dashboard');
  const assignments = courseId ? await apiFetch<Assignment[]>(`/v1/courses/${courseId}/assignments`) : [];
  const submissionLists = await Promise.all(
    assignments.map((a) => apiFetch<Submission[]>(`/v1/assignments/${a.id}/submissions`))
  );

  const performancePoints = assignments.flatMap((a, i) =>
    submissionLists[i]!
      .filter((s) => s.status === 'graded' && s.score !== null && s.gradedAt)
      .map((s) => ({ gradedAt: s.gradedAt as string, percentage: (Number(s.score) / Number(a.maxScore)) * 100 }))
  );

  return (
    <div>
      <h1 className="admin-page-title">Assignments</h1>

      <div className="admin-section">
        <AssignmentCourseSelector courses={dashboard.courses} selected={courseId} />
      </div>

      {courseId && (
        <>
          <div className="admin-section">
            <h2 className="admin-section-title">Class performance</h2>
            <ClassPerformanceChart points={performancePoints} />
          </div>

          <div className="admin-section">
            <h2 className="admin-section-title">Assignments ({assignments.length})</h2>
            {assignments.length === 0 ? (
              <p className="admin-empty">No assignments in this course yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Due</th>
                    <th>Max score</th>
                    <th>Submitted</th>
                    <th>Graded</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a, i) => {
                    const subs = submissionLists[i]!;
                    const graded = subs.filter((s) => s.status === 'graded').length;
                    return (
                      <tr key={a.id}>
                        <td>{a.title}</td>
                        <td>{a.dueAt ? new Date(a.dueAt).toLocaleDateString() : '—'}</td>
                        <td>{a.maxScore}</td>
                        <td>{subs.length}</td>
                        <td>{graded}</td>
                        <td>
                          {subs.length > graded && (
                            <a
                              href={`/teacher/grading?courseId=${courseId}&assignmentId=${a.id}`}
                              className="admin-nav-link"
                              style={{ padding: '4px 8px' }}
                            >
                              Grade &rarr;
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="admin-section">
            <h2 className="admin-section-title">Create an assignment</h2>
            <CreateAssignmentForm courseId={courseId} />
          </div>
        </>
      )}
    </div>
  );
}

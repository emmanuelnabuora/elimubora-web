import Link from 'next/link';
import { apiFetch } from '../../lib/api-client';

interface CourseSummary {
  courseId: string;
  title: string;
  gradeLevel: string;
  pendingGrading: number;
}

interface TeacherDashboard {
  courses: CourseSummary[];
  totalPendingGrading: number;
  lessonPlansByCourse: Record<string, unknown[]>;
}

export default async function TeacherOverviewPage() {
  const dashboard = await apiFetch<TeacherDashboard>('/v1/teacher/dashboard');

  return (
    <div>
      <h1 className="admin-page-title">Overview</h1>

      <div className="kpi-grid">
        <div className="kpi-card">
          <p className="kpi-label">My Courses</p>
          <p className="kpi-value">{dashboard.courses.length}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Pending Grading</p>
          <p className="kpi-value">{dashboard.totalPendingGrading}</p>
        </div>
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">My courses</h2>
        {dashboard.courses.length === 0 ? (
          <p className="admin-empty">You have no courses yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Grade</th>
                <th>Lesson plans</th>
                <th>Pending grading</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {dashboard.courses.map((c) => (
                <tr key={c.courseId}>
                  <td>{c.title}</td>
                  <td>{c.gradeLevel}</td>
                  <td>{(dashboard.lessonPlansByCourse[c.courseId] ?? []).length}</td>
                  <td>{c.pendingGrading}</td>
                  <td>
                    {c.pendingGrading > 0 && (
                      <Link
                        href={`/teacher/grading?courseId=${c.courseId}`}
                        className="admin-nav-link"
                        style={{ padding: '4px 8px' }}
                      >
                        Grade &rarr;
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

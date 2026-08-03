import Link from 'next/link';
import { apiFetch } from '../../lib/api-client';

interface Course {
  id: string;
  title: string;
  learningArea: string;
  gradeLevel: string;
}

export default async function StudentOverviewPage() {
  const courses = await apiFetch<Course[]>('/v1/courses/mine');

  return (
    <div>
      <h1 className="admin-page-title">Overview</h1>

      <div className="kpi-grid">
        <div className="kpi-card">
          <p className="kpi-label">My Courses</p>
          <p className="kpi-value">{courses.length}</p>
        </div>
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">My courses</h2>
        {courses.length === 0 ? (
          <p className="admin-empty">You&rsquo;re not enrolled in any courses yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Learning area</th>
                <th>Grade</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.id}>
                  <td>{c.title}</td>
                  <td>{c.learningArea}</td>
                  <td>{c.gradeLevel}</td>
                  <td>
                    <Link
                      href={`/student/assignments?courseId=${c.id}`}
                      className="admin-nav-link"
                      style={{ padding: '4px 8px' }}
                    >
                      Assignments &rarr;
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">Need help with your homework?</h2>
        <p style={{ color: 'var(--eb-fg-muted)', fontSize: 14, marginBottom: 'var(--eb-space-4)' }}>
          Ask a question about any subject and get a quick explanation.
        </p>
        <Link href="/student/homework-help" className="admin-submit" style={{ textDecoration: 'none' }}>
          Ask for help →
        </Link>
      </div>
    </div>
  );
}

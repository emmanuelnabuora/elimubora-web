import Link from 'next/link';
import { apiFetch } from '../../lib/api-client';
import { getCurrentUser } from '../../lib/get-current-user';

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

interface RosterEntry {
  userId: string;
  courseRole: string;
}

interface TimetableSlot {
  dayOfWeek: number;
}

export default async function TeacherOverviewPage() {
  const result = await getCurrentUser();
  const teacherId = result!.user.id;
  const academicYear = new Date().getFullYear();

  const dashboard = await apiFetch<TeacherDashboard>('/v1/teacher/dashboard');

  const [rosters, timetable] = await Promise.all([
    Promise.all(dashboard.courses.map((c) => apiFetch<RosterEntry[]>(`/v1/courses/${c.courseId}/roster`))),
    apiFetch<TimetableSlot[]>(`/v1/timetable/teacher/${teacherId}?academicYear=${academicYear}`)
  ]);

  // Real learner count, not per-course sums that could double-count a
  // student enrolled in more than one of this teacher's courses.
  const uniqueLearners = new Set<string>();
  rosters.forEach((roster) =>
    roster.filter((r) => r.courseRole === 'learner').forEach((r) => uniqueLearners.add(r.userId))
  );

  const todayIso = new Date().getDay(); // 0=Sunday..6=Saturday
  const todayDayOfWeek = todayIso === 0 ? 7 : todayIso; // matches the 1=Monday..7=Sunday convention used elsewhere
  const classesToday = timetable.filter((s) => s.dayOfWeek === todayDayOfWeek).length;

  return (
    <div>
      <h1 className="admin-page-title">Overview</h1>

      <div className="kpi-grid">
        <div className="kpi-card">
          <p className="kpi-label">My Learners</p>
          <p className="kpi-value">{uniqueLearners.size}</p>
          <p className="kpi-sub">Across {dashboard.courses.length} courses</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Classes Today</p>
          <p className="kpi-value">{classesToday}</p>
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

import { apiFetch, ApiError } from '../../lib/api-client';
import { getCurrentUser } from '../../lib/get-current-user';
import { RefreshButton } from './RefreshButton';

interface EnrollmentSnapshot {
  countyCode: string | null;
  academicYear: number;
  totalStudents: number;
  totalSchools: number;
  snapshotTakenAt: string;
}

interface AttendanceSnapshot {
  countyCode: string | null;
  academicYear: number;
  averageAttendanceRate: string;
  snapshotTakenAt: string;
}

const REFRESH_ROLES = new Set(['ministry_official', 'platform_admin']);

async function fetchOrNull<T>(path: string): Promise<T | null> {
  try {
    return await apiFetch<T>(path);
  } catch (err) {
    // No snapshot has been computed yet for this year/county — a real,
    // expected state (the backend returns an actual 404 here, not an
    // empty object), not an error to propagate.
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export default async function GovernmentOverviewPage() {
  const result = await getCurrentUser();
  const user = result!.user;
  const academicYear = new Date().getFullYear();
  const canRefresh = REFRESH_ROLES.has(user.role);
  const isNational = user.role !== 'county_officer';

  const [enrollment, attendance, byCounty] = await Promise.all([
    fetchOrNull<EnrollmentSnapshot>(`/v1/gov/enrollment?academicYear=${academicYear}`),
    fetchOrNull<AttendanceSnapshot>(`/v1/gov/attendance?academicYear=${academicYear}`),
    isNational
      ? apiFetch<EnrollmentSnapshot[]>(`/v1/gov/enrollment/by-county?academicYear=${academicYear}`).catch(() => [])
      : Promise.resolve([])
  ]);

  const hasData = enrollment !== null || attendance !== null;

  return (
    <div>
      <h1 className="admin-page-title">National Overview</h1>
      <p style={{ color: 'var(--eb-fg-muted)', fontSize: 14, marginTop: -16, marginBottom: 'var(--eb-space-6)' }}>
        {isNational ? `Academic year ${academicYear} · national` : `Academic year ${academicYear} · your county only`}
      </p>

      {!hasData ? (
        <div className="admin-section">
          <p className="admin-empty">
            No {academicYear} statistics have been computed yet.
            {canRefresh
              ? ' This is a real, snapshot-based system — nothing shows until a ministry official refreshes it.'
              : ' Ask a ministry official to refresh this year\u2019s statistics.'}
          </p>
          {canRefresh && (
            <div style={{ marginTop: 'var(--eb-space-4)' }}>
              <RefreshButton academicYear={academicYear} />
            </div>
          )}
        </div>
      ) : (
        <>
          {canRefresh && (
            <div className="admin-section">
              <RefreshButton academicYear={academicYear} />
              {enrollment && (
                <p style={{ fontSize: 12, color: 'var(--eb-fg-muted)', marginTop: 8, marginBottom: 0 }}>
                  Last refreshed {new Date(enrollment.snapshotTakenAt).toLocaleString()}
                </p>
              )}
            </div>
          )}

          <div className="kpi-grid">
            <div className="kpi-card">
              <p className="kpi-label">Registered Learners</p>
              <p className="kpi-value">{enrollment ? enrollment.totalStudents.toLocaleString() : '—'}</p>
            </div>
            <div className="kpi-card">
              <p className="kpi-label">Institutions</p>
              <p className="kpi-value">{enrollment ? enrollment.totalSchools.toLocaleString() : '—'}</p>
            </div>
            <div className="kpi-card">
              <p className="kpi-label">Average Attendance</p>
              <p className="kpi-value">{attendance ? `${attendance.averageAttendanceRate}%` : '—'}</p>
            </div>
          </div>

          {isNational && byCounty.length > 0 && (
            <div className="admin-section">
              <h2 className="admin-section-title">By county ({byCounty.length})</h2>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>County code</th>
                    <th>Learners</th>
                    <th>Institutions</th>
                  </tr>
                </thead>
                <tbody>
                  {byCounty
                    .slice()
                    .sort((a, b) => b.totalStudents - a.totalStudents)
                    .map((c) => (
                      <tr key={c.countyCode ?? 'national'}>
                        <td>{c.countyCode ?? '—'}</td>
                        <td>{c.totalStudents.toLocaleString()}</td>
                        <td>{c.totalSchools.toLocaleString()}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

import { apiFetch } from '../../lib/api-client';

interface StudentListItem {
  studentId: string;
  status: string;
}

interface TenantUser {
  userId: string;
  role: string;
}

interface CollectionSummary {
  invoiceCount: number;
  collectionRatePercent: number | null;
}

interface LeaveRequestItem {
  id: string;
}

export default async function AdminOverviewPage() {
  const academicYear = new Date().getFullYear();

  const [students, users, collection, pendingLeave] = await Promise.all([
    apiFetch<StudentListItem[]>('/v1/students'),
    apiFetch<TenantUser[]>('/v1/users?limit=100'),
    apiFetch<CollectionSummary>(`/v1/analytics/finance/collection-summary?academicYear=${academicYear}`).catch(
      () => ({ invoiceCount: 0, collectionRatePercent: null })
    ),
    apiFetch<LeaveRequestItem[]>('/v1/leave-requests/pending')
  ]);

  const activeStudents = students.filter((s) => s.status === 'active').length;
  const staffCount = users.filter((u) => u.role !== 'learner').length;

  return (
    <div>
      <h1 className="admin-page-title">Overview</h1>

      <div className="kpi-grid">
        <div className="kpi-card">
          <p className="kpi-label">Active Students</p>
          <p className="kpi-value">{activeStudents}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Staff</p>
          <p className="kpi-value">{staffCount}</p>
          <p className="kpi-sub">Teachers, admins &amp; other staff roles</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Fee Collection ({academicYear})</p>
          <p className="kpi-value">
            {collection.collectionRatePercent !== null ? `${collection.collectionRatePercent}%` : '—'}
          </p>
          <p className="kpi-sub">
            {collection.invoiceCount > 0 ? `${collection.invoiceCount} invoices` : 'No invoices yet'}
          </p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Pending Leave Requests</p>
          <p className="kpi-value">{pendingLeave.length}</p>
        </div>
      </div>
    </div>
  );
}

import Link from 'next/link';
import { Users, UserCog, Wallet, ClipboardCheck, GraduationCap, PiggyBank, Contact } from 'lucide-react';
import { apiFetch } from '../../lib/api-client';
import { StudentsByGradeChart } from '../../components/StudentsByGradeChart';
import { FeeCollectionDonut } from '../../components/FeeCollectionDonut';
import { CompositionDonut } from '../../components/CompositionDonut';

interface StudentListItem {
  studentId: string;
  status: string;
  gradeLevel: string | null;
}

interface TenantUser {
  userId: string;
  role: string;
}

interface CollectionSummary {
  totalInvoiced: string;
  totalCollected: string;
  invoiceCount: number;
  collectionRatePercent: number | null;
}

interface LeaveRequestItem {
  id: string;
  staffName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
}

export default async function AdminOverviewPage() {
  const academicYear = new Date().getFullYear();

  const [students, users, collection, pendingLeave] = await Promise.all([
    apiFetch<StudentListItem[]>('/v1/students'),
    apiFetch<TenantUser[]>('/v1/users?limit=100'),
    apiFetch<CollectionSummary>(`/v1/analytics/finance/collection-summary?academicYear=${academicYear}`).catch(
      () => ({ totalInvoiced: '0', totalCollected: '0', invoiceCount: 0, collectionRatePercent: null })
    ),
    apiFetch<LeaveRequestItem[]>('/v1/leave-requests/pending')
  ]);

  const activeStudents = students.filter((s) => s.status === 'active');
  const staffCount = users.filter((u) => u.role !== 'learner' && u.role !== 'parent').length;
  const gradeCounts: Record<string, number> = {};
  for (const s of activeStudents) {
    if (s.gradeLevel) gradeCounts[s.gradeLevel] = (gradeCounts[s.gradeLevel] ?? 0) + 1;
  }
  const invoiced = Number(collection.totalInvoiced);
  const collected = Number(collection.totalCollected);
  const outstanding = Math.max(invoiced - collected, 0);

  const roleLabels: Record<string, string> = {
    teacher: 'Teachers',
    school_admin: 'School Admins',
    principal: 'Principals'
  };
  const roleColors: Record<string, string> = {
    teacher: '#5546e8',
    school_admin: '#3478e5',
    principal: '#f59e0b'
  };
  const roleCounts: Record<string, number> = {};
  for (const u of users) {
    if (roleLabels[u.role]) roleCounts[u.role] = (roleCounts[u.role] ?? 0) + 1;
  }
  const staffSegments = Object.entries(roleCounts).map(([role, count]) => ({
    name: roleLabels[role]!,
    value: count,
    color: roleColors[role]!
  }));

  return (
    <div>
      <h1 className="sa-greeting-title">Overview</h1>
      <p className="sa-greeting-sub">Here&rsquo;s what&rsquo;s happening in your school today.</p>

      <div className="sa-kpi-grid">
        <div className="sa-kpi-card tone-purple">
          <p className="sa-kpi-label">Active Students</p>
          <p className="sa-kpi-value">{activeStudents.length}</p>
          <span className="sa-kpi-trend neutral">{students.length} total enrolled</span>
        </div>
        <div className="sa-kpi-card tone-green">
          <p className="sa-kpi-label">Staff</p>
          <p className="sa-kpi-value">{staffCount}</p>
          <span className="sa-kpi-trend neutral">Teachers &amp; admin</span>
        </div>
        <div className="sa-kpi-card tone-blue">
          <p className="sa-kpi-label">Fee Collection Rate</p>
          <p className="sa-kpi-value">
            {collection.collectionRatePercent !== null ? `${collection.collectionRatePercent}%` : '—'}
          </p>
          <span className="sa-kpi-trend neutral">{academicYear}</span>
        </div>
        <div className="sa-kpi-card tone-orange">
          <p className="sa-kpi-label">Invoices Issued</p>
          <p className="sa-kpi-value">{collection.invoiceCount}</p>
          <span className="sa-kpi-trend neutral">{academicYear}</span>
        </div>
        <div className="sa-kpi-card tone-red">
          <p className="sa-kpi-label">Outstanding Fees</p>
          <p className="sa-kpi-value">KES {outstanding.toLocaleString()}</p>
          <span className="sa-kpi-trend neutral">of KES {invoiced.toLocaleString()} invoiced</span>
        </div>
        <div className="sa-kpi-card tone-purple">
          <p className="sa-kpi-label">Pending Leave</p>
          <p className="sa-kpi-value">{pendingLeave.length}</p>
          <span className="sa-kpi-trend neutral">awaiting a decision</span>
        </div>
      </div>

      <div className="sa-grid cols-3">
        <div className="sa-card">
          <div className="sa-card-header">
            <h2 className="sa-card-title">
              <GraduationCap />
              Students by Grade
            </h2>
          </div>
          <StudentsByGradeChart counts={gradeCounts} />
        </div>

        <div className="sa-card">
          <div className="sa-card-header">
            <h2 className="sa-card-title">
              <PiggyBank />
              Fee Collection
            </h2>
          </div>
          <FeeCollectionDonut collected={collected} outstanding={outstanding} />
          <Link href="/admin/fees" className="sa-link" style={{ marginTop: 16, display: 'inline-flex' }}>
            View financial report →
          </Link>
        </div>

        <div className="sa-card">
          <div className="sa-card-header">
            <h2 className="sa-card-title">
              <ClipboardCheck />
              Leave Requests
            </h2>
            <Link href="/admin/leave-requests" className="sa-link">
              View all
            </Link>
          </div>
          {pendingLeave.length === 0 ? (
            <p className="sa-empty">Nothing awaiting a decision.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {pendingLeave.slice(0, 5).map((r) => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{r.staffName}</span>
                  <span style={{ color: 'var(--sa-text-muted)', textTransform: 'capitalize' }}>{r.leaveType}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="sa-grid staff-row">
        <div className="sa-card">
          <div className="sa-card-header">
            <h2 className="sa-card-title">
              <Contact />
              Staff Overview
            </h2>
            <Link href="/admin/staff" className="sa-link">
              View all
            </Link>
          </div>
          <CompositionDonut segments={staffSegments} centerValue={staffCount} centerLabel="Total Staff" />
        </div>
        <Link href="/admin/students" className="sa-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="sa-card-header" style={{ marginBottom: 0 }}>
            <h2 className="sa-card-title">
              <Users />
              Manage Students
            </h2>
            <span className="sa-link">Go →</span>
          </div>
        </Link>
        <Link href="/admin/staff" className="sa-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="sa-card-header" style={{ marginBottom: 0 }}>
            <h2 className="sa-card-title">
              <UserCog />
              Manage Staff
            </h2>
            <span className="sa-link">Go →</span>
          </div>
        </Link>
      </div>
    </div>
  );
}

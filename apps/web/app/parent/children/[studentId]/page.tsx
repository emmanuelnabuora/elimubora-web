import Link from 'next/link';
import { apiFetch } from '../../../../lib/api-client';
import { ChildSwitcher } from './ChildSwitcher';
import { WeeklyAttendanceChart } from './WeeklyAttendanceChart';
import { PaymentForm } from './PaymentForm';
import { CompositionDonut } from '../../../../components/CompositionDonut';

interface Child {
  studentId: string;
  fullName: string;
  admissionNumber: string;
}

interface AttendanceRecord {
  id: string;
  attendanceDate: string;
  status: string;
}

interface BehaviourNote {
  id: string;
  category: string;
  note: string;
  occurredAt: string;
}

interface Payment {
  id: string;
  amount: string;
  method: string;
  status: string;
  paidAt: string | null;
}

interface Invoice {
  id: string;
  academicYear: number;
  term: number;
  amountDue: string;
  amountPaid: string;
  status: string;
  payments: Payment[];
}

interface Submission {
  status: string;
  score: string | null;
}

interface PerformanceCourse {
  courseId: string;
  title: string;
  assignments: Array<{ assignmentId: string; title: string; submission: Submission | null }>;
}

export default async function ChildDetailPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;

  const [children, attendance, behaviourNotes, fees, performance] = await Promise.all([
    apiFetch<Child[]>('/v1/parent-portal/children'),
    apiFetch<AttendanceRecord[]>(`/v1/parent-portal/children/${studentId}/attendance`),
    apiFetch<BehaviourNote[]>(`/v1/parent-portal/children/${studentId}/behaviour-notes`),
    apiFetch<Invoice[]>(`/v1/parent-portal/children/${studentId}/fees`),
    apiFetch<PerformanceCourse[]>(`/v1/parent-portal/children/${studentId}/performance`)
  ]);

  const child = children.find((c) => c.studentId === studentId);
  const presentCount = attendance.filter((a) => a.status === 'present').length;
  const attendanceRate = attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) : null;

  return (
    <div>
      <Link href="/parent" className="admin-nav-link" style={{ padding: '4px 0', display: 'inline-block' }}>
        &larr; My Children
      </Link>
      <ChildSwitcher children={children} currentId={studentId} />
      <h1 className="admin-page-title">{child?.fullName ?? 'Child'}</h1>

      <div className="kpi-grid">
        <div className="kpi-card">
          <p className="kpi-label">Attendance Rate</p>
          <p className="kpi-value">{attendanceRate !== null ? `${attendanceRate}%` : '—'}</p>
          <p className="kpi-sub">{attendance.length} days recorded</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Courses</p>
          <p className="kpi-value">{performance.length}</p>
        </div>
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">Attendance ({attendance.length})</h2>
        {attendance.length > 0 && (
          <div style={{ marginBottom: 'var(--eb-space-4)' }}>
            <WeeklyAttendanceChart records={attendance} />
          </div>
        )}
        {attendance.length === 0 ? (
          <p className="admin-empty">No attendance recorded yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {attendance
                .slice()
                .sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate))
                .slice(0, 10)
                .map((a) => (
                  <tr key={a.id}>
                    <td>{a.attendanceDate}</td>
                    <td>
                      <span className={`status-pill ${a.status === 'present' ? 'active' : 'inactive'}`}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">Behaviour notes ({behaviourNotes.length})</h2>
        {behaviourNotes.length === 0 ? (
          <p className="admin-empty">No behaviour notes yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {behaviourNotes.map((n) => (
                <tr key={n.id}>
                  <td>{new Date(n.occurredAt).toLocaleDateString()}</td>
                  <td>
                    <span className={`status-pill ${n.category === 'positive' ? 'active' : 'pending'}`}>
                      {n.category}
                    </span>
                  </td>
                  <td>{n.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">Fees ({fees.length})</h2>
        {fees.length > 0 &&
          (() => {
            const totalPaid = fees.reduce((sum, f) => sum + Number(f.amountPaid), 0);
            const totalOutstanding = fees.reduce(
              (sum, f) => sum + Math.max(Number(f.amountDue) - Number(f.amountPaid), 0),
              0
            );
            return (
              <div style={{ marginBottom: 'var(--eb-space-4)' }}>
                <CompositionDonut
                  segments={[
                    { name: 'Paid', value: totalPaid, color: '#22C55E' },
                    { name: 'Outstanding', value: totalOutstanding, color: '#EF4444' }
                  ]}
                  centerValue={totalPaid + totalOutstanding}
                  centerLabel="Total fees (KES)"
                />
              </div>
            );
          })()}
        {fees.length === 0 ? (
          <p className="admin-empty">No invoices yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Year / Term</th>
                <th>Due</th>
                <th>Paid</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {fees.map((f) => (
                <tr key={f.id}>
                  <td>
                    {f.academicYear} / T{f.term}
                  </td>
                  <td>KES {f.amountDue}</td>
                  <td>KES {f.amountPaid}</td>
                  <td>
                    <span
                      className={`status-pill ${f.status === 'paid' ? 'active' : f.status === 'partial' ? 'pending' : 'inactive'}`}
                    >
                      {f.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">Make a payment</h2>
        <PaymentForm invoices={fees} />
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">Performance</h2>
        {performance.length === 0 ? (
          <p className="admin-empty">Not enrolled in any courses yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 'var(--eb-space-4)' }}>
            {performance.map((course) => (
              <div key={course.courseId}>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>{course.title}</h3>
                {course.assignments.length === 0 ? (
                  <p className="admin-empty">No assignments yet.</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Assignment</th>
                        <th>Status</th>
                        <th>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {course.assignments.map((a) => (
                        <tr key={a.assignmentId}>
                          <td>{a.title}</td>
                          <td>
                            <span
                              className={`status-pill ${a.submission?.status === 'graded' ? 'active' : a.submission ? 'pending' : 'inactive'}`}
                            >
                              {a.submission?.status ?? 'not submitted'}
                            </span>
                          </td>
                          <td>{a.submission?.score ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

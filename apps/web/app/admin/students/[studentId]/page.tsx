import Link from 'next/link';
import { apiFetch } from '../../../../lib/api-client';
import { AddGuardianForm } from './AddGuardianForm';
import { ActivateAccountForm } from './ActivateAccountForm';
import { LinkGuardianAccountAction } from './LinkGuardianAccountAction';

interface StudentListItem {
  studentId: string;
  fullName: string;
  admissionNumber: string;
  status: string;
  className: string | null;
  gradeLevel: string | null;
}

interface Guardian {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  userId: string | null;
}

interface TenantUser {
  userId: string;
  fullName: string;
  email: string;
  role: string;
}

export default async function StudentDetailPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;

  const [students, guardians, users] = await Promise.all([
    apiFetch<StudentListItem[]>('/v1/students'),
    apiFetch<Guardian[]>(`/v1/students/${studentId}/guardians`),
    apiFetch<TenantUser[]>('/v1/users?limit=100')
  ]);

  const student = students.find((s) => s.studentId === studentId);
  const parentAccounts = users.filter((u) => u.role === 'parent');

  return (
    <div>
      <Link href="/admin/students" className="admin-nav-link" style={{ padding: '4px 0', display: 'inline-block' }}>
        &larr; Students
      </Link>
      <h1 className="admin-page-title">{student?.fullName ?? 'Student'}</h1>
      {student && (
        <p style={{ color: 'var(--eb-fg-muted)', fontSize: 14, marginTop: -16, marginBottom: 'var(--eb-space-6)' }}>
          Admission #{student.admissionNumber} &middot; {student.className ?? 'No class assigned'}
        </p>
      )}

      <div className="admin-section">
        <h2 className="admin-section-title">Portal access</h2>
        <ActivateAccountForm studentId={studentId} />
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">Guardians ({guardians.length})</h2>
        {guardians.length === 0 ? (
          <p className="admin-empty">No guardians linked yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Portal access</th>
              </tr>
            </thead>
            <tbody>
              {guardians.map((g) => (
                <tr key={g.id}>
                  <td>{g.fullName}</td>
                  <td>{g.phone ?? '—'}</td>
                  <td>{g.email ?? '—'}</td>
                  <td>
                    <span className={`status-pill ${g.userId ? 'active' : 'inactive'}`}>
                      {g.userId ? 'Linked' : 'Not linked'}
                    </span>
                    {!g.userId && (
                      <div style={{ marginTop: 6 }}>
                        <LinkGuardianAccountAction guardianId={g.id} parentAccounts={parentAccounts} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">Add a guardian</h2>
        <AddGuardianForm studentId={studentId} parentAccounts={parentAccounts} />
      </div>
    </div>
  );
}

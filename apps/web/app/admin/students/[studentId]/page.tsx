import Link from 'next/link';
import { apiFetch } from '../../../../lib/api-client';
import { AddGuardianForm } from './AddGuardianForm';
import { ActivateAccountForm } from './ActivateAccountForm';
import { LinkGuardianAccountAction } from './LinkGuardianAccountAction';
import { ImageUploadField } from '../../../../components/ImageUploadField';
import { EditStudentDetailsForm } from './EditStudentDetailsForm';
import { RequestTransferForm } from '../../../../components/RequestTransferForm';
import { IssueCertificateForm } from '../../../../components/IssueCertificateForm';

interface StudentListItem {
  studentId: string;
  fullName: string;
  admissionNumber: string;
  status: string;
  className: string | null;
  gradeLevel: string | null;
}

interface StudentProfile {
  dateOfBirth: string | null;
  gender: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  photoDataUrl: string | null;
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

interface Certificate {
  id: string;
  title: string;
  certificateNumber: string;
  issuedAt: string;
}

export default async function StudentDetailPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;

  const [students, profile, guardians, users, certificates] = await Promise.all([
    apiFetch<StudentListItem[]>('/v1/students'),
    apiFetch<StudentProfile>(`/v1/students/${studentId}`),
    apiFetch<Guardian[]>(`/v1/students/${studentId}/guardians`),
    apiFetch<TenantUser[]>('/v1/users?limit=100'),
    apiFetch<Certificate[]>(`/v1/certificates/student/${studentId}`)
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
        <h2 className="admin-section-title">Photo</h2>
        <ImageUploadField
          endpoint={`/api/admin/students/${studentId}/photo`}
          fieldName="photoDataUrl"
          currentImageUrl={profile.photoDataUrl}
          label="photo"
          shape="circle"
          maxDimension={512}
        />
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">Details</h2>
        <EditStudentDetailsForm studentId={studentId} profile={profile} />
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">Portal access</h2>
        <ActivateAccountForm studentId={studentId} />
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">Transfer to another school</h2>
        <RequestTransferForm studentId={studentId} />
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">Certificates ({certificates.length})</h2>
        {certificates.length > 0 && (
          <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
            {certificates.map((c) => (
              <div key={c.id} style={{ border: '1px solid var(--eb-line)', borderRadius: 12, padding: 12 }}>
                <p style={{ margin: '0 0 2px', fontWeight: 600, fontSize: 14 }}>{c.title}</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--eb-fg-muted)' }}>
                  {c.certificateNumber} \u2022 {new Date(c.issuedAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
        <IssueCertificateForm studentId={studentId} />
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

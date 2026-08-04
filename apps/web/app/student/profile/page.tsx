import { apiFetch } from '../../../lib/api-client';

interface MyProfile {
  studentId: string;
  fullName: string;
  admissionNumber: string;
  dateOfBirth: string | null;
  gender: string | null;
  status: string;
  classStreamId: string | null;
  className: string | null;
  gradeLevel: string | null;
}

export default async function MyProfilePage() {
  const profile = await apiFetch<MyProfile>('/v1/students/me');

  return (
    <div>
      <h1 className="admin-page-title">My Profile</h1>

      <div className="admin-section">
        <h2 className="admin-section-title">{profile.fullName}</h2>
        <table className="data-table">
          <tbody>
            <tr>
              <td style={{ color: 'var(--eb-fg-muted)', width: 180 }}>Admission number</td>
              <td>{profile.admissionNumber}</td>
            </tr>
            <tr>
              <td style={{ color: 'var(--eb-fg-muted)' }}>Grade</td>
              <td>{profile.gradeLevel ?? '—'}</td>
            </tr>
            <tr>
              <td style={{ color: 'var(--eb-fg-muted)' }}>Class</td>
              <td>{profile.className ?? 'No class assigned'}</td>
            </tr>
            <tr>
              <td style={{ color: 'var(--eb-fg-muted)' }}>Status</td>
              <td>
                <span className={`status-pill ${profile.status === 'active' ? 'active' : 'inactive'}`}>
                  {profile.status.replace('_', ' ')}
                </span>
              </td>
            </tr>
            {profile.dateOfBirth && (
              <tr>
                <td style={{ color: 'var(--eb-fg-muted)' }}>Date of birth</td>
                <td>{profile.dateOfBirth}</td>
              </tr>
            )}
            {profile.gender && (
              <tr>
                <td style={{ color: 'var(--eb-fg-muted)' }}>Gender</td>
                <td style={{ textTransform: 'capitalize' }}>{profile.gender}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

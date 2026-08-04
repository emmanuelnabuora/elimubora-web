import { apiFetch } from '../../../lib/api-client';
import { SubmitApplicationForm } from './SubmitApplicationForm';
import { ApplicationsList } from './ApplicationsList';

interface Application {
  id: string;
  candidateName: string;
  guardianName: string;
  guardianPhone: string;
  gradeLevelApplied: string;
  status: string;
  notes: string | null;
}

export default async function AdmissionsPage() {
  const applications = await apiFetch<Application[]>('/v1/admissions');
  const pending = applications.filter((a) => a.status === 'submitted' || a.status === 'under_review');
  const decided = applications.filter((a) => a.status !== 'submitted' && a.status !== 'under_review');

  return (
    <div>
      <h1 className="admin-page-title">Admissions</h1>

      <div className="admin-section">
        <h2 className="admin-section-title">New application</h2>
        <SubmitApplicationForm />
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">Awaiting a decision ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="admin-empty">Nothing awaiting a decision.</p>
        ) : (
          <ApplicationsList applications={pending} />
        )}
      </div>

      {decided.length > 0 && (
        <div className="admin-section">
          <h2 className="admin-section-title">Decided ({decided.length})</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Grade</th>
                <th>Guardian</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {decided.map((a) => (
                <tr key={a.id}>
                  <td>{a.candidateName}</td>
                  <td>{a.gradeLevelApplied}</td>
                  <td>{a.guardianName}</td>
                  <td>
                    <span
                      className={`status-pill ${a.status === 'admitted' ? 'active' : a.status === 'rejected' ? 'inactive' : 'pending'}`}
                    >
                      {a.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Application {
  id: string;
  candidateName: string;
  guardianName: string;
  guardianPhone: string;
  gradeLevelApplied: string;
  status: string;
}

export function ApplicationsList({ applications }: { applications: Application[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(id: string, status: 'admitted' | 'rejected' | 'waitlisted') {
    setPendingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/admissions/${id}/decision`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not record that decision. Try again.');
        return;
      }
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <>
      {error && <p className="auth-error">{error}</p>}
      <table className="data-table">
        <thead>
          <tr>
            <th>Candidate</th>
            <th>Grade</th>
            <th>Guardian</th>
            <th>Phone</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {applications.map((a) => (
            <tr key={a.id}>
              <td>{a.candidateName}</td>
              <td>{a.gradeLevelApplied}</td>
              <td>{a.guardianName}</td>
              <td>{a.guardianPhone}</td>
              <td>
                <div className="admin-action-row">
                  <button
                    type="button"
                    className="admin-btn-approve"
                    disabled={pendingId === a.id}
                    onClick={() => decide(a.id, 'admitted')}
                  >
                    Admit
                  </button>
                  <button
                    type="button"
                    className="admin-btn-deny"
                    disabled={pendingId === a.id}
                    onClick={() => decide(a.id, 'waitlisted')}
                  >
                    Waitlist
                  </button>
                  <button
                    type="button"
                    className="admin-btn-deny"
                    disabled={pendingId === a.id}
                    onClick={() => decide(a.id, 'rejected')}
                  >
                    Reject
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

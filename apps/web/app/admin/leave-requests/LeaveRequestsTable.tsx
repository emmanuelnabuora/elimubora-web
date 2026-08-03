'use client';

import { useState } from 'react';

interface LeaveRequestItem {
  id: string;
  staffId: string;
  staffName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: string;
}

export function LeaveRequestsTable({ initialRequests }: { initialRequests: LeaveRequestItem[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(id: string, status: 'approved' | 'rejected') {
    setPendingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leave-requests/${id}/decision`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not record that decision. Try again.');
        return;
      }
      // Decided requests leave the "pending" list — remove it directly
      // rather than refetching, since we already have the confirmed result.
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setPendingId(null);
    }
  }

  if (requests.length === 0) {
    return <p className="admin-empty">No leave requests are awaiting a decision.</p>;
  }

  return (
    <>
      {error && <p className="auth-error">{error}</p>}
      <table className="data-table">
        <thead>
          <tr>
            <th>Staff</th>
            <th>Type</th>
            <th>Dates</th>
            <th>Reason</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id}>
              <td>{r.staffName}</td>
              <td style={{ textTransform: 'capitalize' }}>{r.leaveType}</td>
              <td>
                {r.startDate} &rarr; {r.endDate}
              </td>
              <td>{r.reason ?? '—'}</td>
              <td>
                <div className="admin-action-row">
                  <button
                    type="button"
                    className="admin-btn-approve"
                    disabled={pendingId === r.id}
                    onClick={() => decide(r.id, 'approved')}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="admin-btn-deny"
                    disabled={pendingId === r.id}
                    onClick={() => decide(r.id, 'rejected')}
                  >
                    Deny
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

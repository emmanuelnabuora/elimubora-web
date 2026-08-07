'use client';

import { useState } from 'react';

interface TransferItem {
  id: string;
  fromTenantId: string;
  toTenantId: string;
  studentName: string | null;
  fromTenantName: string;
  toTenantName: string;
  status: string;
  reason: string | null;
}

export function TransfersTable({
  initialTransfers,
  myTenantId
}: {
  initialTransfers: TransferItem[];
  myTenantId: string;
}) {
  const [transfers, setTransfers] = useState(initialTransfers);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(id: string, status: 'accepted' | 'rejected') {
    setPendingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/transfers/${id}/decision`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not record that decision. Try again.');
        return;
      }
      setTransfers((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setPendingId(null);
    }
  }

  if (transfers.length === 0) {
    return <p className="admin-empty">No transfer requests yet.</p>;
  }

  return (
    <>
      {error && <p className="auth-error">{error}</p>}
      <table className="data-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>From</th>
            <th>To</th>
            <th>Reason</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {transfers.map((t) => {
            const isIncoming = t.toTenantId === myTenantId;
            return (
              <tr key={t.id}>
                <td>{t.studentName ?? <span style={{ color: 'var(--eb-fg-muted)' }}>Not visible yet</span>}</td>
                <td>{t.fromTenantName}</td>
                <td>{t.toTenantName}</td>
                <td>{t.reason ?? '—'}</td>
                <td style={{ textTransform: 'capitalize' }}>{t.status}</td>
                <td>
                  {isIncoming && t.status === 'pending' && (
                    <div className="admin-action-row">
                      <button
                        type="button"
                        className="admin-btn-approve"
                        disabled={pendingId === t.id}
                        onClick={() => decide(t.id, 'accepted')}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="admin-btn-deny"
                        disabled={pendingId === t.id}
                        onClick={() => decide(t.id, 'rejected')}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

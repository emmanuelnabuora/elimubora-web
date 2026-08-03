'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Invitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
}

export function InvitationsTable({ invitations }: { invitations: Invitation[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function revoke(id: string) {
    setPendingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/invitations/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not revoke that invitation. Try again.');
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
            <th>Email</th>
            <th>Role</th>
            <th>Expires</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {invitations.map((inv) => (
            <tr key={inv.id}>
              <td>{inv.email}</td>
              <td style={{ textTransform: 'capitalize' }}>{inv.role.replace('_', ' ')}</td>
              <td>{new Date(inv.expiresAt).toLocaleDateString()}</td>
              <td>
                <button
                  type="button"
                  className="admin-btn-deny"
                  disabled={pendingId === inv.id}
                  onClick={() => revoke(inv.id)}
                >
                  Revoke
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

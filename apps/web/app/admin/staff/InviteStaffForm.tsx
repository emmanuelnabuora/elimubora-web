'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

const INVITABLE_ROLES = ['teacher', 'school_admin', 'principal', 'parent'] as const;

export function InviteStaffForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<(typeof INVITABLE_ROLES)[number]>('teacher');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admin/invitations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, role })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not send that invitation. Try again.');
        return;
      }
      setSuccess(`Invitation sent to ${email}.`);
      setEmail('');
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="admin-form-row">
        <label className="admin-field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="admin-field">
          <span>Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} required>
            {INVITABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {r.replace('_', ' ')}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="auth-error">{error}</p>}
      {success && (
        <p className="dashboard-subhead" style={{ color: 'var(--eb-primary)' }}>
          {success}
        </p>
      )}
      <button type="submit" className="admin-submit" disabled={loading}>
        {loading ? 'Sending…' : 'Send invitation'}
      </button>
    </form>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export function ActivateAccountForm({ studentId }: { studentId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/students/${studentId}/activate-account`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not activate this account. Try again.');
        return;
      }
      setSuccess(`Account activated — ${data.email} can now sign in with the password you set.`);
      setPassword('');
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p style={{ fontSize: 13, color: 'var(--eb-fg-muted)', marginTop: 0, marginBottom: 12 }}>
        Enrollment creates a placeholder account with no usable login. Set a real email and password here to give
        this student actual sign-in access.
      </p>
      <div className="admin-form-row">
        <label className="admin-field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="admin-field">
          <span>Password</span>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={12}
            placeholder="At least 12 characters"
          />
        </label>
      </div>
      {error && <p className="auth-error">{error}</p>}
      {success && (
        <p className="dashboard-subhead" style={{ color: 'var(--eb-primary)' }}>
          {success}
        </p>
      )}
      <button type="submit" className="admin-submit" disabled={loading}>
        {loading ? 'Activating…' : 'Activate account'}
      </button>
    </form>
  );
}

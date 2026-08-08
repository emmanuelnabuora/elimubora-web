'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function IssueCertificateForm({ studentId }: { studentId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch('/api/admin/certificates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ studentId, title })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not issue that certificate. Try again.');
        return;
      }
      setSuccess(true);
      setTitle('');
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label className="admin-field">
        <span>Certificate title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Grade 5 Term 1 Mathematics CAT — Distinction"
          required
          maxLength={300}
        />
      </label>
      {error && <p className="auth-error">{error}</p>}
      {success && (
        <p className="dashboard-subhead" style={{ color: 'var(--eb-primary)' }}>
          Certificate issued.
        </p>
      )}
      <button type="submit" className="admin-submit" disabled={loading}>
        {loading ? 'Issuing…' : 'Issue certificate'}
      </button>
    </form>
  );
}

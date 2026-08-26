'use client';

import { useEffect, useState, type FormEvent } from 'react';

interface StatusResult {
  status: 'pending' | 'approved' | 'rejected';
  schoolName: string;
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

const STATUS_COPY: Record<StatusResult['status'], { title: string; body: (r: StatusResult) => string }> = {
  pending: {
    title: 'Still under review',
    body: (r) => `We're still reviewing the application for ${r.schoolName}. We'll email you as soon as there's an update.`
  },
  approved: {
    title: 'Application approved',
    body: (r) => `Good news — ${r.schoolName} has been approved. Check your email for a link to set up your admin account.`
  },
  rejected: {
    title: 'Application not approved',
    body: (r) => `We weren't able to move forward with the application for ${r.schoolName} at this time.`
  }
};

/**
 * Public, token-based lookup -- no login, matching the invitation
 * preview/decline flow's own no-account-needed pattern. `initialToken`
 * comes from ?token= in the confirmation link (see
 * SchoolApplicationsService.submit's statusUrl); a visitor without a
 * link in hand can still paste the token in manually.
 */
export function ApplicationStatusView({ initialToken }: { initialToken: string }) {
  const [token, setToken] = useState(initialToken);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StatusResult | null>(null);

  async function check(t: string) {
    if (!t.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/school-applications/status', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: t.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'No application found for this link.');
        return;
      }
      setResult(data);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialToken) check(initialToken);
    // Only run once, off the link the person actually arrived with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    check(token);
  }

  if (result) {
    const copy = STATUS_COPY[result.status];
    return (
      <div className="auth-card">
        <h2>{copy.title}</h2>
        <p className="auth-desc">{copy.body(result)}</p>
        {result.status === 'rejected' && result.rejectionReason && (
          <p className="auth-desc">
            <strong>Reason:</strong> {result.rejectionReason}
          </p>
        )}
        <p className="auth-desc" style={{ fontSize: 12, color: '#8a91a3' }}>
          Submitted {new Date(result.submittedAt).toLocaleDateString()}
          {result.reviewedAt ? ` · Reviewed ${new Date(result.reviewedAt).toLocaleDateString()}` : ''}
        </p>
        <a href="/" className="auth-submit" style={{ display: 'inline-block', textAlign: 'center', textDecoration: 'none', marginTop: 8 }}>
          Return home
        </a>
      </div>
    );
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit}>
      <div>
        <h2>Check application status</h2>
        <p className="auth-welcome">Paste the link or token from your confirmation email.</p>
      </div>
      <label className="auth-field">
        <span>Status token</span>
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste your status token" required />
      </label>
      {error && <p className="auth-error">{error}</p>}
      <button type="submit" className="auth-submit" disabled={loading || !token.trim()}>
        {loading ? 'Checking…' : 'Check status'}
      </button>
    </form>
  );
}

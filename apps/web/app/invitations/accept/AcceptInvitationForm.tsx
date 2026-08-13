'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

type Preview = { role: string; studentName: string | null };

export function AcceptInvitationForm({ token }: { token: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<'accepted' | 'declined' | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/auth/invitations/preview/${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.role) setPreview(data);
        else setPreviewError(data.message ?? 'This invitation link is invalid or has expired.');
      })
      .catch(() => {
        if (!cancelled) setPreviewError('Could not reach the server. Check your connection and try again.');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/invitations/accept', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, fullName, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not accept this invitation. It may have expired or already been used.');
        return;
      }
      setDone('accepted');
      setTimeout(() => router.push('/login'), 2000);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDecline() {
    setDeclining(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/invitations/decline', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not decline this invitation.');
        return;
      }
      setDone('declined');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setDeclining(false);
    }
  }

  if (done === 'accepted') {
    return (
      <div className="auth-card">
        <h2>Account created</h2>
        <p className="auth-desc">Taking you to sign in…</p>
      </div>
    );
  }

  if (done === 'declined') {
    return (
      <div className="auth-card">
        <h2>Invitation declined</h2>
        <p className="auth-desc">You won&rsquo;t be signed up from this link. No account was created.</p>
      </div>
    );
  }

  if (previewError) {
    return (
      <div className="auth-card">
        <h2>Invalid invitation link</h2>
        <p className="auth-desc">{previewError}</p>
      </div>
    );
  }

  const welcomeText = preview?.studentName
    ? `You've been invited to join ElimuBora as a parent, linked to ${preview.studentName}'s profile.`
    : preview
      ? `You've been invited to join ElimuBora as ${preview.role}.`
      : 'Loading your invitation…';

  return (
    <form className="auth-card" onSubmit={handleSubmit}>
      <div>
        <h2>Set up your account</h2>
        <p className="auth-welcome">{welcomeText}</p>
      </div>
      <label className="auth-field">
        <span>Full name</span>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} autoFocus />
      </label>
      <label className="auth-field">
        <span>Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={12}
          autoComplete="new-password"
        />
      </label>
      {error && <p className="auth-error">{error}</p>}
      <button type="submit" className="auth-submit" disabled={loading || !preview}>
        {loading ? 'Creating account…' : 'Create account'}
      </button>
      {preview && (
        <button
          type="button"
          className="auth-link-button"
          onClick={handleDecline}
          disabled={declining || loading}
          style={{ background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
        >
          {declining ? 'Declining…' : "Not you? Decline this invitation"}
        </button>
      )}
    </form>
  );
}

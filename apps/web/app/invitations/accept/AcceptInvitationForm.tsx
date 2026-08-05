'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export function AcceptInvitationForm({ token }: { token: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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
      setDone(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="auth-card">
        <h2>Account created</h2>
        <p className="auth-desc">Taking you to sign in…</p>
      </div>
    );
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit}>
      <div>
        <h2>Set up your account</h2>
        <p className="auth-welcome">You&rsquo;ve been invited to join ElimuBora. Set your name and password to get started.</p>
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
      <button type="submit" className="auth-submit" disabled={loading}>
        {loading ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  );
}

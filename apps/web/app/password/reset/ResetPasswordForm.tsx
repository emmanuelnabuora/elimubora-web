'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/password/reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? 'This reset link is invalid or has expired. Request a new one.');
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
        <h2>Password updated</h2>
        <p className="auth-desc">
          You&rsquo;ve been signed out everywhere else for safety. Taking you to sign in…
        </p>
      </div>
    );
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit}>
      <div>
        <h2>Set a new password</h2>
        <p className="auth-desc">Choose a new password for your account.</p>
      </div>
      <label className="auth-field">
        <span>New password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={12}
          autoComplete="new-password"
          autoFocus
        />
      </label>
      <label className="auth-field">
        <span>Confirm new password</span>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={12}
          autoComplete="new-password"
        />
      </label>
      {error && <p className="auth-error">{error}</p>}
      <button type="submit" className="auth-submit" disabled={loading}>
        {loading ? 'Updating…' : 'Update password'}
      </button>
    </form>
  );
}

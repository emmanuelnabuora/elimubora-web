'use client';

import { useState, type FormEvent } from 'react';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/password/forgot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? 'Something went wrong. Please try again.');
        return;
      }
      setSent(true);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="auth-card">
        <h2>Check your email</h2>
        <p className="auth-desc">
          If an account exists for <strong>{email}</strong>, we&rsquo;ve sent a link to reset the password. It expires
          soon, so use it shortly.
        </p>
        <a href="/login" className="auth-submit" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
          Back to sign in
        </a>
      </div>
    );
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit}>
      <div>
        <h2>Forgot your password?</h2>
        <p className="auth-desc">Enter your email and we&rsquo;ll send you a link to reset it.</p>
      </div>
      <label className="auth-field">
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          autoComplete="email"
        />
      </label>
      {error && <p className="auth-error">{error}</p>}
      <button type="submit" className="auth-submit" disabled={loading}>
        {loading ? 'Sending…' : 'Send reset link'}
      </button>
      <p className="auth-footnote">
        Remembered it after all? <a href="/login">Back to sign in</a>
      </p>
    </form>
  );
}

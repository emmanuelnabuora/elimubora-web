'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { RoleConfig } from '../../../lib/roles';

interface Membership {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  role: string;
}

type Stage = 'credentials' | 'mfa' | 'select_institution';

export function LoginForm({ role }: { role: RoleConfig }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitLogin(tenantId?: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, tenantId })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Something went wrong. Try again.');
        return;
      }
      if (data.status === 'authenticated') {
        router.push('/dashboard');
        return;
      }
      if (data.status === 'mfa_required') {
        setMfaToken(data.mfaToken);
        setStage('mfa');
        return;
      }
      if (data.status === 'select_institution') {
        setMemberships(data.memberships);
        setStage('select_institution');
        return;
      }
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCredentialsSubmit(e: FormEvent) {
    e.preventDefault();
    await submitLogin();
  }

  async function handleMfaSubmit(e: FormEvent) {
    e.preventDefault();
    if (!mfaToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mfaToken, code: mfaCode })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Incorrect code. Try again.');
        return;
      }
      router.push('/dashboard');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  if (stage === 'select_institution') {
    return (
      <div className="auth-card" style={{ ['--door-accent' as string]: role.accent }}>
        <p className="auth-step-label">Choose your institution</p>
        <p className="auth-desc">Your account is linked to more than one institution.</p>
        <div className="institution-list">
          {memberships.map((m) => (
            <button
              key={m.tenantId}
              type="button"
              className="institution-option"
              onClick={() => submitLogin(m.tenantId)}
              disabled={loading}
            >
              <span>{m.tenantName}</span>
              <span className="institution-role">{m.role.replace('_', ' ')}</span>
            </button>
          ))}
        </div>
        {error && <p className="auth-error">{error}</p>}
      </div>
    );
  }

  if (stage === 'mfa') {
    return (
      <form
        className="auth-card"
        onSubmit={handleMfaSubmit}
        style={{ ['--door-accent' as string]: role.accent }}
      >
        <p className="auth-step-label">Enter your verification code</p>
        <p className="auth-desc">Open your authenticator app and enter the 6-digit code.</p>
        <label className="auth-field">
          <span>Verification code</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
            required
            autoFocus
          />
        </label>
        {error && <p className="auth-error">{error}</p>}
        <button type="submit" className="auth-submit" disabled={loading || mfaCode.length !== 6}>
          {loading ? 'Verifying…' : 'Verify and sign in'}
        </button>
      </form>
    );
  }

  return (
    <form
      className="auth-card"
      onSubmit={handleCredentialsSubmit}
      style={{ ['--door-accent' as string]: role.accent }}
    >
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
      <label className="auth-field">
        <span>Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </label>
      {error && <p className="auth-error">{error}</p>}
      <button type="submit" className="auth-submit" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
      <a className="auth-forgot" href="/forgot-password">
        Forgot your password?
      </a>
    </form>
  );
}

'use client';

import { AuthError, login, MissingIdentityError } from '@netlify/identity';
import { useState, type FormEvent } from 'react';
import { GoogleLogo, MicrosoftLogo } from '../../../components/icons';
import type { RoleConfig } from '../../../lib/roles';

interface Membership {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  role: string;
}

type Stage = 'credentials' | 'mfa' | 'select_institution';

/** Excludes `icon` (a component reference) — functions can't cross the
 *  server-to-client-component boundary, and this form never renders it anyway. */
type LoginFormRole = Omit<RoleConfig, 'icon'>;

export function LoginForm({ role }: { role: LoginFormRole }) {
  const [stage, setStage] = useState<Stage>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [socialNote, setSocialNote] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitLogin(tenantId?: string) {
    setLoading(true);
    setError(null);
    try {
      void tenantId;
      await login(email.trim(), password);
      window.location.href = '/dashboard';
    } catch (error) {
      if (error instanceof MissingIdentityError) {
        setError('Authentication is not configured for this site.');
      } else if (error instanceof AuthError) {
        setError(error.status === 401 ? 'Invalid email or password.' : error.message);
      } else {
        setError('Could not reach the authentication service. Check your connection and try again.');
      }
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
      const data = await res.json().catch(() => ({ message: 'Authentication returned an invalid response.' }));
      if (!res.ok) {
        setError(data.message ?? 'Incorrect code. Try again.');
        return;
      }
      window.location.href = '/dashboard';
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  if (stage === 'select_institution') {
    return (
      <div className="auth-card" style={{ ['--door-accent' as string]: role.accent }}>
        <h2 className="auth-step-label">Choose your institution</h2>
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
        <h2 className="auth-step-label">Enter your verification code</h2>
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
      <div>
        <h2>{role.label} sign in</h2>
        <p className="auth-welcome">Welcome back! Please sign in to continue.</p>
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
      <label className="auth-field">
        <div className="auth-field-row">
          <span>Password</span>
          <a href="/forgot-password">Forgot password?</a>
        </div>
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
      <div className="auth-social-divider">or continue with</div>
      <div className="auth-social-row">
        <button
          type="button"
          className="auth-social-button"
          onClick={() => setSocialNote('Google sign-in is not connected yet — use email and password for now.')}
        >
          <GoogleLogo /> Google
        </button>
        <button
          type="button"
          className="auth-social-button"
          onClick={() => setSocialNote('Microsoft sign-in is not connected yet — use email and password for now.')}
        >
          <MicrosoftLogo /> Microsoft
        </button>
      </div>
      {socialNote && <p className="auth-social-note">{socialNote}</p>}
      <p className="auth-footnote">{role.contactNote}</p>
    </form>
  );
}

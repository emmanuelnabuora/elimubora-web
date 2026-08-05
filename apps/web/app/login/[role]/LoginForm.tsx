'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { EyeIcon, EyeOffIcon, GoogleLogo, LockIcon, MailIcon, MicrosoftLogo } from '../../../components/icons';
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

export function LoginForm({ role, embedded = false }: { role: LoginFormRole; embedded?: boolean }) {
  const cardClass = embedded ? undefined : 'auth-card';
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
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
      <div className={cardClass} style={{ ['--door-accent' as string]: role.accent }}>
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
        className={cardClass}
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
      className={cardClass}
      onSubmit={handleCredentialsSubmit}
      style={{ ['--door-accent' as string]: role.accent }}
    >
      {!embedded && (
        <div>
          <h2>{role.label} sign in</h2>
          <p className="auth-welcome">Welcome back! Please sign in to continue.</p>
        </div>
      )}
      <label className="auth-field">
        <span>Email</span>
        <div className="auth-input-wrap">
          <MailIcon className="auth-input-icon" width={18} height={18} />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            required
            autoFocus
            autoComplete="email"
          />
        </div>
      </label>
      <label className="auth-field">
        <span>Password</span>
        <div className="auth-input-wrap">
          <LockIcon className="auth-input-icon" width={18} height={18} />
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            autoComplete="current-password"
          />
          <button
            type="button"
            className="auth-input-toggle"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOffIcon width={18} height={18} /> : <EyeIcon width={18} height={18} />}
          </button>
        </div>
      </label>
      <div className="auth-field-row" style={{ marginTop: -6 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--eb-fg-muted)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            style={{ width: 15, height: 15, accentColor: 'var(--eb-primary)' }}
          />
          Remember me
        </label>
        <a href="/forgot-password">Forgot password?</a>
      </div>
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
      <p className="auth-footnote">
        {(() => {
          const [question, ...rest] = role.contactNote.split('? ');
          const action = rest.join('? ');
          return (
            <>
              {question}?{' '}
              <a href="/help">{action}</a>
            </>
          );
        })()}
      </p>
    </form>
  );
}

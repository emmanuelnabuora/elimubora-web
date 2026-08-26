'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { EyeIcon, EyeOffIcon, GoogleLogo, LockIcon, MailIcon, MicrosoftLogo } from '../../../components/icons';
import { ROLE_CONFIG, type RoleConfig } from '../../../lib/roles';

interface Membership {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  role: string;
}

/**
 * Maps a backend membership role to the frontend role-tab slug it
 * belongs under. Several backend roles collapse into one tab
 * (school_admin/principal/platform_admin -> admin;
 * county_officer/ministry_official -> ministry) since the login UI
 * only exposes five role choices, not eight.
 */
function membershipRoleToSlug(role: string): string {
  switch (role) {
    case 'learner':
      return 'student';
    case 'school_admin':
    case 'principal':
    case 'platform_admin':
      return 'admin';
    case 'county_officer':
    case 'ministry_official':
      return 'ministry';
    default:
      return role; // teacher, parent already match their slug directly
  }
}

type Stage = 'credentials' | 'mfa' | 'select_institution' | 'role_mismatch';

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
  const [socialNote, setSocialNote] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [actualRoleSlugs, setActualRoleSlugs] = useState<string[]>([]);
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
        const loginMemberships = (data.memberships as Membership[] | undefined) ?? [];
        const roleSlugs = [...new Set(loginMemberships.map((m) => membershipRoleToSlug(m.role)))];
        // The login itself already succeeded and cookies are set at
        // this point -- this check is purely about not silently
        // sending someone to a dashboard that won't match what they
        // expected from the role tab they picked, which is what was
        // actually happening before (a blind redirect regardless of
        // whether the account's real role matched the selected tab).
        if (roleSlugs.length > 0 && !roleSlugs.includes(role.slug)) {
          setActualRoleSlugs(roleSlugs);
          setStage('role_mismatch');
          return;
        }
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

  if (stage === 'role_mismatch') {
    return (
      <div className={cardClass} style={{ ['--door-accent' as string]: role.accent }}>
        <h2 className="auth-step-label">Wrong role selected</h2>
        <p className="auth-desc">
          This account isn&rsquo;t registered as a {role.label}. You&rsquo;re signed in — you just picked the wrong
          tab.
        </p>
        <div className="institution-list">
          {actualRoleSlugs.map((slug) => {
            const actualRole = ROLE_CONFIG[slug];
            if (!actualRole) return null;
            return (
              <a key={slug} href={`/login/${slug}`} className="institution-option">
                <span>Sign in as {actualRole.label}</span>
              </a>
            );
          })}
        </div>
        <button
          type="button"
          className="auth-social-button"
          style={{ width: '100%', marginTop: 'var(--eb-space-3)' }}
          onClick={() => router.push('/dashboard')}
        >
          Continue anyway
        </button>
      </div>
    );
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
        <span>Email or Admission Number</span>
        <div className="auth-input-wrap">
          <MailIcon className="auth-input-icon" width={18} height={18} />
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email or admission number"
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
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
          <GoogleLogo width={22} height={22} /> Google
        </button>
        <button
          type="button"
          className="auth-social-button"
          onClick={() => setSocialNote('Microsoft sign-in is not connected yet — use email and password for now.')}
        >
          <MicrosoftLogo width={22} height={22} /> Microsoft
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
              <a href={role.contactHref ?? '/help'}>{action}</a>
            </>
          );
        })()}
      </p>
    </form>
  );
}

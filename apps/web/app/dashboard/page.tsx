import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SiteHeader } from '../../components/SiteHeader';
import { getCurrentUser } from '../../lib/get-current-user';
import { LogoutButton } from './LogoutButton';

const ADMIN_ROLES = new Set(['school_admin', 'principal', 'platform_admin']);

/**
 * Confirms a real, working session — identity, active role, and every
 * institution the account belongs to — pulled live from the NestJS
 * API through the cookie session just established. Building out full
 * per-role dashboard UI (a teacher's actual gradebook view, a
 * parent's actual fee summary) is real, separate future work; this
 * page's job is to prove the authentication system this sprint added
 * actually works end to end.
 *
 * Note: if the access token needed a silent refresh to render this
 * page, the new cookie isn't persisted from here (Server Components
 * can't set cookies) — the next call through /api/auth/me will. No
 * user-visible effect, just an occasional extra refresh call.
 */
export default async function DashboardPage() {
  const result = await getCurrentUser();
  if (!result) redirect('/');
  const { user } = result;

  return (
    <main className="dashboard-page landing-theme">
      <SiteHeader showHelp={false} />
      <div className="dashboard-body">
        <div className="dashboard-card">
          <p className="dashboard-role-label">Signed in</p>
          <h1 className="dashboard-name">{user.fullName}</h1>
          <dl className="dashboard-facts">
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Active role</dt>
              <dd style={{ textTransform: 'capitalize' }}>{user.role.replace('_', ' ')}</dd>
            </div>
            <div>
              <dt>Two-factor authentication</dt>
              <dd>{user.totpEnabled ? 'On' : 'Off'}</dd>
            </div>
          </dl>
          <p className="dashboard-subhead">Institutions</p>
          <ul className="dashboard-memberships">
            {user.memberships.map((m) => (
              <li key={m.tenantId}>
                <span>{m.tenantName}</span>
                <span className="institution-role">{m.role.replace('_', ' ')}</span>
              </li>
            ))}
          </ul>
          {ADMIN_ROLES.has(user.role) && (
            <Link href="/admin" className="admin-submit" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginBottom: 'var(--eb-space-3)' }}>
              Go to Admin Dashboard →
            </Link>
          )}
          {user.role === 'teacher' && (
            <Link href="/teacher" className="admin-submit" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginBottom: 'var(--eb-space-3)' }}>
              Go to Teacher Dashboard →
            </Link>
          )}
          {user.role === 'learner' && (
            <Link href="/student" className="admin-submit" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginBottom: 'var(--eb-space-3)' }}>
              Go to Student Dashboard →
            </Link>
          )}
          {user.role === 'parent' && (
            <Link href="/parent" className="admin-submit" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginBottom: 'var(--eb-space-3)' }}>
              Go to Parent Dashboard →
            </Link>
          )}
          {(user.role === 'county_officer' || user.role === 'ministry_official') && (
            <Link href="/government" className="admin-submit" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginBottom: 'var(--eb-space-3)' }}>
              Go to National Overview →
            </Link>
          )}
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}

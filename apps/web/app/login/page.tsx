import Link from 'next/link';
import { SiteHeader } from '../../components/SiteHeader';
import { AdminIcon, ArrowRightIcon, ExternalLinkIcon, MinistryIcon } from '../../components/icons';
import { ROLE_CONFIG } from '../../lib/roles';

const primaryRoles = ['teacher', 'student', 'parent'] as const;

/**
 * The role-selector page — a dedicated step between the marketing
 * landing page and an individual role's login form, matching the
 * flow pattern LAUSD's own app uses: land -> click Log In -> choose
 * who you are -> then sign in. Splitting this out of the homepage
 * keeps the landing page a clean single call-to-action rather than
 * mixing marketing content with account selection on one screen.
 */
export default function LoginSelectorPage() {
  const admin = ROLE_CONFIG.admin!;
  return (
    <main className="landing">
      <SiteHeader showHelp={false} />

      <div className="landing-hero" style={{ marginBottom: 'var(--eb-space-8)' }}>
        <h1 className="landing-title" style={{ fontSize: 'clamp(26px, 4vw, 34px)' }}>
          Who&rsquo;s signing in?
        </h1>
        <p className="landing-subtitle">Choose your role to continue to sign in.</p>
      </div>

      <div className="landing-body">
        <div className="door-grid">
          {primaryRoles.map((slug) => {
            const role = ROLE_CONFIG[slug]!;
            const Icon = role.icon;
            return (
              <Link
                key={slug}
                href={`/login/${slug}`}
                className="door-card"
                style={{ ['--door-accent' as string]: role.accent }}
              >
                <span className="door-icon">
                  <Icon width={22} height={22} />
                </span>
                <p className="door-title">{role.label}</p>
                <p className="door-desc">{role.doorDesc}</p>
                <span className="door-signin">
                  Sign in <ArrowRightIcon width={14} height={14} />
                </span>
              </Link>
            );
          })}
        </div>

        <Link
          href="/login/admin"
          className="door-card door-admin"
          style={{ ['--door-accent' as string]: admin.accent }}
        >
          <span className="door-icon">
            <AdminIcon width={22} height={22} />
          </span>
          <span className="door-admin-text">
            <p className="door-title">{admin.label}</p>
            <p className="door-desc">{admin.doorDesc}</p>
          </span>
          <span className="door-signin">
            Sign in <ArrowRightIcon width={14} height={14} />
          </span>
        </Link>

        <p className="secondary-access">
          <Link href="/login/ministry">
            <MinistryIcon width={16} height={16} />
            Ministry / County / Partner access
            <ExternalLinkIcon width={13} height={13} />
          </Link>
        </p>
      </div>
    </main>
  );
}

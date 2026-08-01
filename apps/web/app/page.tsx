import Link from 'next/link';
import { SiteHeader } from '../components/SiteHeader';
import {
  AdminIcon,
  ArrowRightIcon,
  DeviceIcon,
  ExternalLinkIcon,
  FlagIcon,
  MinistryIcon,
  ShieldIcon,
  TrophyIcon
} from '../components/icons';
import { ROLE_CONFIG } from '../lib/roles';

const primaryRoles = ['teacher', 'student', 'parent'] as const;

const features = [
  {
    icon: ShieldIcon,
    title: 'Secure & Reliable',
    desc: 'Your data is protected with enterprise-grade security.'
  },
  {
    icon: DeviceIcon,
    title: 'Accessible Anywhere',
    desc: 'Learn and teach from any device, anytime, anywhere.'
  },
  {
    icon: FlagIcon,
    title: 'Built for Kenya',
    desc: 'Aligned with the national curriculum and policies.'
  },
  {
    icon: TrophyIcon,
    title: 'Empowering Futures',
    desc: 'Technology that transforms education for all.'
  }
];

export default function Home() {
  const admin = ROLE_CONFIG.admin!;
  return (
    <main className="landing">
      <SiteHeader />

      <div className="landing-hero">
        <div className="landing-mark">
          <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 6.5C10.3 5.1 7.8 4.4 5 4.4v13.2c2.8 0 5.3.7 7 2.1 1.7-1.4 4.2-2.1 7-2.1V4.4c-2.8 0-5.3.7-7 2.1Z" />
            <path d="M12 6.5v13.2" />
            <circle cx="12" cy="3.2" r="1.4" fill="var(--eb-accent)" stroke="none" />
          </svg>
        </div>
        <h1 className="landing-title">
          Elimu<span className="accent">Bora</span>
        </h1>
        <p className="landing-tagline">Kenya&rsquo;s National Digital Education Platform</p>
        <p className="landing-subtitle">
          Connecting learners, educators, and schools for a smarter, brighter future.
        </p>
        <div className="landing-divider" aria-hidden="true" />
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

        <div className="feature-strip">
          {features.map((f) => (
            <div className="feature-item" key={f.title}>
              <span className="feature-icon">
                <f.icon width={20} height={20} />
              </span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <footer className="landing-footer">
        <span>&copy; 2026 ElimuBora. All rights reserved.</span>
        <nav>
          <Link href="/help">Help</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/accessibility">Accessibility</Link>
          <Link href="/language">Language</Link>
        </nav>
      </footer>
    </main>
  );
}

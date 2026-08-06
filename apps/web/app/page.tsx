import { LandingLoginPanel } from '../components/LandingLoginPanel';
import { CheckIcon, DeviceIcon, FlagIcon, GlobeIcon, ShieldIcon, TrophyIcon } from '../components/icons';
import Link from 'next/link';

const features = [
  { icon: FlagIcon, title: 'One Platform', desc: 'All education stakeholders, connected.' },
  { icon: TrophyIcon, title: 'Smart Learning', desc: 'Data-driven insights for better outcomes.' },
  { icon: ShieldIcon, title: 'Secure & Reliable', desc: 'Your data is protected with enterprise-grade security.' },
  { icon: DeviceIcon, title: 'Accessible Anywhere', desc: 'Learn, teach, and manage from any device.' }
];

/**
 * Landing page: matches the supplied design brief's split-screen
 * layout exactly. The login flow itself is unchanged from before --
 * LandingLoginPanel reuses the same LoginForm component and
 * submission logic that /login/[role] has always used, just switching
 * roles via tabs on this one page instead of a separate role-select
 * step. /login and /login/[role] still exist and work exactly as
 * before for anyone linking directly to them.
 */
export default function Home() {
  return (
    <main className="auth-page landing-theme">
      <div className="auth-split">
        <section className="auth-illustration">
          <Link href="/" className="site-header-brand" style={{ marginBottom: 'var(--eb-space-2)' }}>
            <span className="site-header-mark">
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 6.5C10.3 5.1 7.8 4.4 5 4.4v13.2c2.8 0 5.3.7 7 2.1 1.7-1.4 4.2-2.1 7-2.1V4.4c-2.8 0-5.3.7-7 2.1Z" />
                <path d="M12 6.5v13.2" />
              </svg>
            </span>
            ElimuBora
          </Link>
          <p style={{ fontSize: 13, color: 'var(--eb-fg-muted)', margin: '-8px 0 var(--eb-space-4) 32px' }}>
            Empowering Education
          </p>

          <h1>
            Welcome to
            <br />
            <span style={{ color: 'var(--eb-primary)' }}>ElimuBora</span>
          </h1>
          <p className="lede">
            Kenya&rsquo;s unified digital education platform connecting schools, learners, teachers and parents for
            a better future.
          </p>

          <ul className="auth-feature-list" style={{ marginTop: 'var(--eb-space-6)' }}>
            {features.map((f) => (
              <li key={f.title} style={{ alignItems: 'flex-start', gap: 12 }}>
                <f.icon width={20} height={20} />
                <span>
                  <strong style={{ display: 'block', color: 'var(--eb-fg)' }}>{f.title}</strong>
                  <span style={{ color: 'var(--eb-fg-muted)', fontSize: 13 }}>{f.desc}</span>
                </span>
              </li>
            ))}
          </ul>

          <p style={{ fontSize: 13, color: 'var(--eb-fg-muted)', marginTop: 'var(--eb-space-8)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckIcon width={16} height={16} />
            Building a smarter, stronger education system for Kenya.
          </p>
        </section>

        <section className="auth-form-side" style={{ flexDirection: 'column', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 'var(--eb-space-4)', right: 'var(--eb-space-4)', display: 'flex', gap: 12 }}>
            <Link href="/language" className="pill-button">
              <GlobeIcon width={16} height={16} />
              English
            </Link>
            <Link href="/help" className="pill-button">
              Help
            </Link>
          </div>
          <LandingLoginPanel />
          <p style={{ fontSize: 12, color: 'var(--eb-fg-muted)', marginTop: 'var(--eb-space-6)' }}>
            &copy; 2026 ElimuBora Education Management System. All rights reserved.
          </p>
        </section>
      </div>
    </main>
  );
}

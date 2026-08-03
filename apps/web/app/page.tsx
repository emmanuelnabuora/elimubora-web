import Link from 'next/link';
import { SiteHeader } from '../components/SiteHeader';
import { ArrowRightIcon, DeviceIcon, FlagIcon, ShieldIcon, TrophyIcon } from '../components/icons';

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

/**
 * Landing page: a single, clear call to action (matching LAUSD's own
 * flow) rather than mixing role selection into the marketing page.
 * Log In -> /login (a dedicated role-selector step) -> /login/[role]
 * (the actual sign-in form).
 */
export default function Home() {
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
        <div className="landing-cta-row">
          <Link href="/login" className="landing-cta">
            Log In <ArrowRightIcon width={16} height={16} />
          </Link>
        </div>

        <div className="feature-strip" style={{ marginTop: 'var(--eb-space-16)' }}>
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

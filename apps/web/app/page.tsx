import { LandingLoginPanel } from '../components/LandingLoginPanel';
import { BuildingIcon, ChalkboardIcon, ChevronDownIcon, DeviceIcon, GlobeIcon, HelpIcon, ParentGroupIcon, ShieldIcon, TrophyIcon, UsersIcon } from '../components/icons';
import Link from 'next/link';

const features = [
  { icon: TrophyIcon, title: 'One Unified Platform', desc: 'All education stakeholders, connected in one seamless ecosystem.' },
  { icon: DeviceIcon, title: 'Smart & Data-Driven', desc: 'Real-time insights that drive better teaching and learning outcomes.' },
  { icon: ShieldIcon, title: 'Secure & Reliable', desc: 'Enterprise-grade security protecting every learner and institution.' },
  { icon: BuildingIcon, title: 'Accessible Anywhere', desc: 'Learn, teach and manage from any device, anytime, anywhere.' }
];

const stats = [
  { icon: BuildingIcon, value: '28,000+', label: 'Schools' },
  { icon: UsersIcon, value: '12M+', label: 'Learners' },
  { icon: ChalkboardIcon, value: '500K+', label: 'Teachers' },
  { icon: ParentGroupIcon, value: '10M+', label: 'Parents' }
];

/**
 * Landing page: matches the supplied design brief's split-screen
 * layout. The login flow itself is unchanged from before --
 * LandingLoginPanel reuses the same LoginForm component and
 * submission logic that /login/[role] has always used, just switching
 * roles via tabs on this one page instead of a separate role-select
 * step. /login and /login/[role] still exist and work exactly as
 * before for anyone linking directly to them.
 *
 * The brief's hero image (a photograph of a teacher and students) is
 * deliberately not included here -- embedding a real photo of people
 * would mean either fabricating one or sourcing an unlicensed stock
 * image directly into the product's codebase, neither of which is
 * appropriate. The Kenya outline is a genuine substitute: an original,
 * simplified SVG approximation of the country's shape (geographic
 * outlines are factual, not copyrighted content), used the same
 * decorative way the brief's map silhouette was -- faded, behind the
 * content, not as a literal photograph replacement.
 */
export default function Home() {
  return (
    <main className="auth-page landing-theme">
      <div style={{ height: 4, background: 'linear-gradient(90deg, var(--sa-purple, #5B4CF5), var(--sa-purple-secondary, #6C5CFF) 45%, var(--eb-line) 45%)' }} />
      <div className="auth-split">
        <section className="auth-illustration">
          <div className="auth-illustration-content">
            <svg
              viewBox="0 0 400 400"
              aria-hidden="true"
              style={{ position: 'absolute', top: '8%', right: '-8%', width: '65%', height: 'auto', opacity: 0.16, color: 'var(--sa-purple, #5B4CF5)' }}
            >
              <path
                fill="currentColor"
                d="M180 20 L230 15 L245 45 L290 55 L310 90 L295 120 L320 150 L305 190 L330 220 L310 260 L325 300 L290 330 L270 310 L245 340 L215 320 L200 350 L170 330 L160 295 L130 285 L120 250 L95 235 L105 195 L85 165 L110 140 L100 105 L135 85 L140 50 L180 20 Z"
              />
            </svg>

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
              Kenya&rsquo;s National
              <br />
              <span style={{ color: 'var(--eb-primary)' }}>Digital Education</span> Platform
            </h1>
            <p className="lede">
              Connecting schools, learners, teachers and families on one secure platform for better learning
              outcomes.
            </p>

            <ul className="auth-feature-list" style={{ marginTop: 'var(--eb-space-6)' }}>
              {features.map((f) => (
                <li key={f.title} style={{ alignItems: 'flex-start', gap: 12 }}>
                  <span className="auth-illustration-badge" style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }}>
                    <f.icon width={18} height={18} />
                  </span>
                  <span>
                    <strong style={{ display: 'block', color: 'var(--eb-fg)' }}>{f.title}</strong>
                    <span style={{ color: 'var(--eb-fg-muted)', fontSize: 13 }}>{f.desc}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div
              style={{
                marginTop: 'var(--eb-space-6)',
                background: 'var(--eb-surface, #ffffff)',
                border: '1px solid var(--eb-line)',
                borderRadius: 16,
                padding: 'var(--eb-space-4)',
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start'
              }}
            >
              <span className="auth-illustration-badge" style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }}>
                <BuildingIcon width={20} height={20} />
              </span>
              <span>
                <strong style={{ display: 'block', color: 'var(--eb-fg)', fontSize: 14 }}>
                  Building a smarter, stronger education system for Kenya.
                </strong>
                <Link href="/help" style={{ fontSize: 13, color: 'var(--eb-primary)', fontWeight: 600, textDecoration: 'none' }}>
                  Learn more about ElimuBora &rarr;
                </Link>
              </span>
            </div>
          </div>

          <div className="auth-stats-bar">
            {stats.map((s) => (
              <div key={s.label} className="auth-stat">
                <s.icon width={26} height={26} />
                <span>
                  <strong>{s.value}</strong>
                  <span>{s.label}</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="auth-form-side" style={{ flexDirection: 'column', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 'var(--eb-space-4)', right: 'var(--eb-space-4)', display: 'flex', gap: 12 }}>
            <Link href="/language" className="pill-button">
              <GlobeIcon width={16} height={16} />
              English
              <ChevronDownIcon width={14} height={14} />
            </Link>
            <Link href="/help" className="pill-button">
              <HelpIcon width={16} height={16} />
              Help
            </Link>
          </div>
          <LandingLoginPanel />
          <p style={{ fontSize: 12, color: 'var(--eb-fg-muted)', marginTop: 'var(--eb-space-4)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldIcon width={14} height={14} />
            Secure &bull; Reliable &bull; Built for Kenya
          </p>
          <p style={{ fontSize: 11, color: 'var(--eb-fg-muted)', marginTop: 'var(--eb-space-2)' }}>
            &copy; 2026 ElimuBora Education Management System. All rights reserved.
          </p>
        </section>
      </div>
    </main>
  );
}

import Link from 'next/link';
import { LandingLoginPanel } from '../components/LandingLoginPanel';
import {
  BuildingIcon,
  ChalkboardIcon,
  ChevronDownIcon,
  DeviceIcon,
  GlobeIcon,
  GraduationCapIcon,
  HelpIcon,
  ParentGroupIcon,
  ShieldIcon,
  UsersIcon
} from '../components/icons';

const features = [
  { icon: UsersIcon, title: 'One Unified Platform', desc: 'All education stakeholders, connected in one seamless ecosystem.' },
  { icon: GraduationCapIcon, title: 'Smart & Data-Driven', desc: 'Real-time insights that drive better teaching and learning outcomes.' },
  { icon: ShieldIcon, title: 'Secure & Reliable', desc: 'Enterprise-grade security protecting every learner and institution.' },
  { icon: DeviceIcon, title: 'Accessible Anywhere', desc: 'Learn, teach, and manage from any device, anytime.' }
];

const stats = [
  { icon: BuildingIcon, value: '28,000+', label: 'Schools' },
  { icon: UsersIcon, value: '12M+', label: 'Learners' },
  { icon: ChalkboardIcon, value: '500K+', label: 'Teachers' },
  { icon: ParentGroupIcon, value: '10M+', label: 'Parents' }
];

/**
 * Landing page, rebuilt to match the ElimuBora Design System v1.0 spec
 * precisely -- exact type scale, spacing, radius, and component
 * dimensions throughout, not just the colors. The login flow itself
 * is unchanged -- LandingLoginPanel reuses the same LoginForm
 * component and submission logic /login/[role] has always used.
 *
 * The hero illustration (public/landing-hero.png) is a real,
 * user-supplied AI-generated image, not a photograph of real people
 * and not a third-party stock image.
 */
export default function Home() {
  return (
    <main className="auth-page landing-theme">
      <div style={{ height: 4, background: 'linear-gradient(90deg, #4338CA, #5B4CF5, #6C5CFF)' }} />
      <div className="auth-split">
        <section className="auth-illustration">
          <div className="auth-illustration-content" style={{ padding: '0 60px', gap: 'var(--ds-space-lg, 24px)' }}>
            <img
              src="/landing-hero.png"
              alt=""
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: '9%',
                right: '-4%',
                width: 'min(56%, 640px)',
                maxHeight: 640,
                height: 'auto',
                opacity: 0.92,
                filter: 'drop-shadow(0 12px 28px rgba(35, 40, 107, 0.18))'
              }}
            />

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                alignSelf: 'flex-start',
                background: 'var(--eb-bg-panel)',
                color: 'var(--eb-primary)',
                fontSize: 13,
                fontWeight: 600,
                padding: '8px 14px',
                borderRadius: 999
              }}
            >
              &#9733; Kenya&rsquo;s National Digital Education Platform
            </div>

            <h1 style={{ fontSize: 64, fontWeight: 800, lineHeight: '72px', letterSpacing: '-0.02em', margin: 0, maxWidth: 460 }}>
              A Smarter Future
              <br />
              Starts with
              <br />
              <span style={{ color: 'var(--eb-primary)' }}>ElimuBora</span>
            </h1>
            <p style={{ fontSize: 18, lineHeight: '28px', color: 'var(--eb-fg-muted)', margin: 0, maxWidth: 440 }}>
              Connecting schools, learners, teachers and families on one secure platform to improve learning outcomes
              across Kenya.
            </p>

            <ul className="auth-feature-list" style={{ marginTop: 'var(--ds-space-md, 16px)', gap: 12 }}>
              {features.map((f) => (
                <li
                  key={f.title}
                  style={{
                    alignItems: 'center',
                    gap: 16,
                    width: 340,
                    minHeight: 96,
                    borderRadius: 20,
                    padding: 20,
                    background: 'var(--eb-surface)',
                    boxShadow: 'var(--ds-shadow-card, 0 12px 30px rgba(31,41,55,.08))'
                  }}
                >
                  <span
                    className="auth-illustration-badge"
                    style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }}
                  >
                    <f.icon width={24} height={24} />
                  </span>
                  <span>
                    <strong style={{ display: 'block', fontSize: 16, color: 'var(--eb-fg)' }}>{f.title}</strong>
                    <span style={{ color: 'var(--eb-fg-muted)', fontSize: 14 }}>{f.desc}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div
              style={{
                marginTop: 'var(--ds-space-sm, 8px)',
                background: 'var(--eb-lavender-bg, #FAF9FF)',
                border: '1px solid var(--eb-line)',
                borderRadius: 20,
                padding: 'var(--ds-space-md, 16px)',
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                maxWidth: 340
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
                <s.icon width={32} height={32} />
                <span>
                  <strong>{s.value}</strong>
                  <span>{s.label}</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="auth-form-side" style={{ flexDirection: 'column', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 32, right: 60, display: 'flex', gap: 12 }}>
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
          <p style={{ fontSize: 14, color: 'var(--eb-fg-muted)', marginTop: 'var(--ds-space-lg, 24px)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldIcon width={14} height={14} />
            Secure &bull; Reliable &bull; Built for Kenya
          </p>
          <p style={{ fontSize: 14, color: 'var(--eb-fg-muted)', marginTop: 'var(--ds-space-sm, 8px)' }}>
            &copy; 2026 ElimuBora Education Management System. All rights reserved.
          </p>
        </section>
      </div>
    </main>
  );
}

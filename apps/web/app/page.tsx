import Link from 'next/link';
import { LandingLoginPanel } from '../components/LandingLoginPanel';
import {
  ChevronDownIcon,
  DeviceIcon,
  GlobeIcon,
  GraduationCapIcon,
  HelpIcon,
  ShieldIcon,
  UsersIcon
} from '../components/icons';

const features = [
  { icon: UsersIcon, tint: '#F5F4FF', color: '#5B4CF5', title: 'One Platform', desc: 'All education stakeholders, connected.' },
  { icon: GraduationCapIcon, tint: '#E9F9EF', color: '#22C55E', title: 'Smart Learning', desc: 'Data-driven insights for better outcomes.' },
  { icon: ShieldIcon, tint: '#EAF1FF', color: '#3B82F6', title: 'Secure & Reliable', desc: 'Your data is protected with highest security.' },
  { icon: DeviceIcon, tint: '#FFF3E0', color: '#F59E0B', title: 'Accessible Anywhere', desc: 'Learn, teach and manage from any device.' }
];

/**
 * Landing page, matching the supplied "Welcome to ElimuBora" mockup
 * as closely as possible, including its illustration -- the hero
 * image (public/landing-hero.png) is a crop of the mockup's own
 * screenshot, extracting just the school-scene illustration and
 * excluding the surrounding text and login card. The crop's
 * background color (#F4F1FD) was confirmed to closely match this
 * page's actual background (--eb-bg-panel, #F5F4FF), so it blends in
 * without needing transparency processing the way the earlier
 * Kenya-shaped image did.
 *
 * "Email or Admission Number": the label and placeholder say this
 * (matching the mockup), and the input type is text rather than email
 * so the browser's built-in validation doesn't reject an admission
 * number as an invalid email address. The backend itself still only
 * authenticates by email -- admission-number login is a real,
 * separate feature that doesn't exist yet, not something this label
 * change implements.
 */
export default function Home() {
  return (
    <main className="auth-page landing-theme">
      <div style={{ height: 4, background: 'linear-gradient(90deg, #4338CA, #5B4CF5, #6C5CFF)' }} />
      <div className="auth-split">
        <section className="auth-illustration">
          <div className="auth-illustration-content" style={{ padding: '48px 60px 0', gap: 'var(--ds-space-lg, 24px)', justifyContent: 'flex-start' }}>
            <h1 style={{ fontSize: 56, fontWeight: 800, lineHeight: '64px', letterSpacing: '-0.02em', margin: 0, maxWidth: 460 }}>
              Welcome to
              <br />
              <span style={{ color: 'var(--eb-primary)' }}>ElimuBora</span>
            </h1>
            <p style={{ fontSize: 18, lineHeight: '28px', color: 'var(--eb-fg-muted)', margin: 0, maxWidth: 420 }}>
              Kenya&rsquo;s unified digital education platform connecting schools, learners, teachers and parents
              for a better future.
            </p>

            <ul className="auth-feature-list" style={{ marginTop: 'var(--ds-space-md, 16px)', gap: 14 }}>
              {features.map((f) => (
                <li key={f.title} style={{ alignItems: 'center', gap: 14 }}>
                  <span
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      flexShrink: 0,
                      display: 'grid',
                      placeItems: 'center',
                      background: f.tint,
                      color: f.color
                    }}
                  >
                    <f.icon width={20} height={20} />
                  </span>
                  <span>
                    <strong style={{ display: 'block', fontSize: 15, color: 'var(--eb-fg)' }}>{f.title}</strong>
                    <span style={{ color: 'var(--eb-fg-muted)', fontSize: 13 }}>{f.desc}</span>
                  </span>
                </li>
              ))}
            </ul>

            <img
              src="/landing-hero.png"
              alt=""
              aria-hidden="true"
              style={{ width: '100%', height: 'auto', marginTop: 'auto', display: 'block' }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'var(--sa-sidebar-1, #23286B)',
              color: '#ffffff',
              padding: '20px 60px',
              position: 'relative',
              zIndex: 1
            }}
          >
            <ShieldIcon width={18} height={18} />
            <span style={{ fontSize: 15, fontWeight: 600 }}>
              Building a smarter, stronger education system for Kenya.
            </span>
          </div>
        </section>

        <section className="auth-form-side" style={{ flexDirection: 'column', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 32, right: 60, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link
              href="/language"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--eb-fg-muted)', textDecoration: 'none' }}
            >
              <GlobeIcon width={16} height={16} />
              English
              <ChevronDownIcon width={14} height={14} />
            </Link>
            <span style={{ width: 1, height: 18, background: 'var(--eb-line)' }} />
            <Link
              href="/help"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--eb-fg-muted)', textDecoration: 'none' }}
            >
              <HelpIcon width={16} height={16} />
              Help
            </Link>
          </div>
          <LandingLoginPanel />
          <p style={{ fontSize: 14, color: 'var(--eb-fg-muted)', marginTop: 'var(--ds-space-lg, 24px)' }}>
            &copy; 2026 ElimuBora Education Management System. All rights reserved.
          </p>
        </section>
      </div>
    </main>
  );
}

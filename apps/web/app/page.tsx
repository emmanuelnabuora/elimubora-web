import Link from 'next/link';

const roles = [
  {
    slug: 'teacher',
    title: 'Teacher',
    description: 'Plan lessons, grade submissions, and mark attendance.',
    accent: 'var(--eb-primary)'
  },
  {
    slug: 'student',
    title: 'Student',
    description: 'See assignments, sit exams, and get homework help.',
    accent: 'var(--eb-primary)'
  },
  {
    slug: 'parent',
    title: 'Parent',
    description: 'Follow attendance, fees, and progress.',
    accent: 'var(--eb-primary)'
  }
] as const;

export default function Home() {
  return (
    <main className="landing">
      <div className="landing-hero">
        <div className="landing-mark" aria-hidden="true">
          E
        </div>
        <h1 className="landing-title">ElimuBora</h1>
        <p className="landing-tagline">Kenya&rsquo;s National Digital Education Platform</p>
      </div>

      <div className="door-grid">
        {roles.map((role) => (
          <Link
            key={role.slug}
            href={`/login/${role.slug}`}
            className="door-card"
            style={{ ['--door-accent' as string]: role.accent }}
          >
            <p className="door-title">{role.title}</p>
            <p className="door-desc">{role.description}</p>
            <span className="door-arrow" aria-hidden="true">
              Sign in <span>&rarr;</span>
            </span>
          </Link>
        ))}
      </div>

      <Link
        href="/login/admin"
        className="door-card door-admin"
        style={{ ['--door-accent' as string]: 'var(--eb-ink-900)' }}
      >
        <span>
          <p className="door-title">School Administrator</p>
          <p className="door-desc">Manage enrolment, staff, and finance.</p>
        </span>
        <span className="door-arrow" aria-hidden="true">
          Sign in <span>&rarr;</span>
        </span>
      </Link>

      <p className="secondary-access">
        <Link href="/login/ministry">Ministry / County / Partner access</Link>
      </p>

      <footer className="landing-footer">
        <Link href="/help">Help</Link>
        <span className="divider">&middot;</span>
        <Link href="/privacy">Privacy</Link>
        <span className="divider">&middot;</span>
        <Link href="/accessibility">Accessibility</Link>
        <span className="divider">&middot;</span>
        <Link href="/language">Language</Link>
      </footer>
    </main>
  );
}

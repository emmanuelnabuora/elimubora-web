import { notFound } from 'next/navigation';
import { SiteHeader } from '../../../components/SiteHeader';
import { CheckIcon } from '../../../components/icons';
import { ROLE_CONFIG, isValidRole } from '../../../lib/roles';
import { LoginForm } from './LoginForm';

export function generateStaticParams() {
  return Object.keys(ROLE_CONFIG).map((role) => ({ role }));
}

export default async function LoginPage({ params }: { params: Promise<{ role: string }> }) {
  const { role: roleSlug } = await params;
  if (!isValidRole(roleSlug)) notFound();
  const role = ROLE_CONFIG[roleSlug]!;
  const Icon = role.icon;

  return (
    <main className="auth-page">
      <SiteHeader showHelp={false} />
      <div className="auth-split">
        <section className="auth-illustration" style={{ ['--door-accent' as string]: role.accent }}>
          <span className="auth-illustration-badge">
            <Icon width={28} height={28} />
          </span>
          <h1>
            Welcome, {role.label} {role.welcomeEmoji}
          </h1>
          <p className="lede">{role.welcomeLede}</p>
          <ul className="auth-feature-list">
            {role.features.map((f) => (
              <li key={f}>
                <CheckIcon width={20} height={20} />
                {f}
              </li>
            ))}
          </ul>
        </section>
        <section className="auth-form-side">
          <LoginForm
            role={{
              slug: role.slug,
              label: role.label,
              doorDesc: role.doorDesc,
              accent: role.accent,
              welcomeEmoji: role.welcomeEmoji,
              welcomeLede: role.welcomeLede,
              features: role.features,
              contactNote: role.contactNote
            }}
          />
        </section>
      </div>
    </main>
  );
}

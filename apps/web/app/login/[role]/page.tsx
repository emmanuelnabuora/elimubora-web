import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ROLE_CONFIG, isValidRole } from '../../../lib/roles';
import { LoginForm } from './LoginForm';

export function generateStaticParams() {
  return Object.keys(ROLE_CONFIG).map((role) => ({ role }));
}

export default async function LoginPage({ params }: { params: Promise<{ role: string }> }) {
  const { role: roleSlug } = await params;
  if (!isValidRole(roleSlug)) notFound();
  const role = ROLE_CONFIG[roleSlug]!;

  return (
    <main className="auth-page">
      <Link href="/" className="auth-back">
        &larr; ElimuBora
      </Link>
      <div className="auth-wrap">
        <p className="auth-role-label">{role.label}</p>
        <h1 className="auth-heading">{role.heading}</h1>
        <LoginForm role={role} />
      </div>
    </main>
  );
}

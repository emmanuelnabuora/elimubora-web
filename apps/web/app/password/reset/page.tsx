import { ResetPasswordForm } from './ResetPasswordForm';

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="auth-page landing-theme" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      {!token ? (
        <div className="auth-card">
          <h2>Invalid reset link</h2>
          <p className="auth-desc">This link is missing its reset token. Request a new one from the sign-in page.</p>
        </div>
      ) : (
        <ResetPasswordForm token={token} />
      )}
    </main>
  );
}

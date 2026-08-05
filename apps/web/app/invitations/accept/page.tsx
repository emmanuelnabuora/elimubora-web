import { AcceptInvitationForm } from './AcceptInvitationForm';

export default async function AcceptInvitationPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="auth-page landing-theme" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      {!token ? (
        <div className="auth-card">
          <h2>Invalid invitation link</h2>
          <p className="auth-desc">This link is missing its invitation token. Ask whoever invited you to resend it.</p>
        </div>
      ) : (
        <AcceptInvitationForm token={token} />
      )}
    </main>
  );
}

import { ApplicationStatusView } from './ApplicationStatusView';

export default async function ApplicationStatusPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="auth-page landing-theme" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: '48px 16px' }}>
      <ApplicationStatusView initialToken={token ?? ''} />
    </main>
  );
}

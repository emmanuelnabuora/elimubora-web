import { SchoolApplicationForm } from './SchoolApplicationForm';

export default function ApplyPage() {
  return (
    <main className="auth-page landing-theme" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: '48px 16px' }}>
      <SchoolApplicationForm />
    </main>
  );
}

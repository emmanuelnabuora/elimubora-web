import { ForgotPasswordForm } from './ForgotPasswordForm';

export default function ForgotPasswordPage() {
  return (
    <main className="auth-page landing-theme" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <ForgotPasswordForm />
    </main>
  );
}

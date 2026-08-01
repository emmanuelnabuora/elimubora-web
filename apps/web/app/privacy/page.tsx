import Link from 'next/link';
import { SiteHeader } from '../../components/SiteHeader';

export default function PrivacyPage() {
  return (
    <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <SiteHeader showHelp={false} />
      <div className="stub-page">
        <div className="stub-page-inner">
          <h1>Privacy</h1>
          <p>
            ElimuBora&rsquo;s full privacy notice — what data is collected, how it&rsquo;s used, and
            your rights under Kenya&rsquo;s Data Protection Act 2019 — is being finalised and will be
            published here before general availability.
          </p>
          <Link href="/" className="stub-back">
            &larr; Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}

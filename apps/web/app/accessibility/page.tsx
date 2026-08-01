import Link from 'next/link';
import { SiteHeader } from '../../components/SiteHeader';

export default function AccessibilityPage() {
  return (
    <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <SiteHeader showHelp={false} />
      <div className="stub-page">
        <div className="stub-page-inner">
          <h1>Accessibility</h1>
          <p>
            ElimuBora is being built for keyboard navigation, screen readers, and reduced motion from
            the start. A full accessibility statement, including our conformance target and how to
            report an issue, will be published here.
          </p>
          <Link href="/" className="stub-back">
            &larr; Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}

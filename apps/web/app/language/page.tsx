import Link from 'next/link';
import { SiteHeader } from '../../components/SiteHeader';

export default function LanguagePage() {
  return (
    <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <SiteHeader showHelp={false} />
      <div className="stub-page">
        <div className="stub-page-inner">
          <h1>Language</h1>
          <p>
            ElimuBora is currently available in English. Kiswahili support is planned — this page
            will offer a real language switch once translated content is ready, rather than a toggle
            that doesn&rsquo;t yet do anything.
          </p>
          <Link href="/" className="stub-back">
            &larr; Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}

import Link from 'next/link';
import { SiteHeader } from '../../components/SiteHeader';

export default function HelpPage() {
  return (
    <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <SiteHeader showHelp={false} />
      <div className="stub-page">
        <div className="stub-page-inner">
          <h1>Help</h1>
          <p>
            Support content for each role — getting started, common questions, and how to reach your
            school&rsquo;s administrator — is being written and will appear here.
          </p>
          <p>
            In the meantime, if you&rsquo;re having trouble signing in, check with your school
            administrator, who can confirm your account and institution.
          </p>
          <Link href="/" className="stub-back">
            &larr; Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}

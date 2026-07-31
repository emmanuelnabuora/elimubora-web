import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="stub-page">
      <h1>Privacy</h1>
      <p>
        ElimuBora&rsquo;s full privacy notice — what data is collected, how it&rsquo;s used, and
        your rights under Kenya&rsquo;s Data Protection Act 2019 — is being finalised and will be
        published here before general availability.
      </p>
      <Link href="/" className="stub-back">
        &larr; Back to sign in
      </Link>
    </main>
  );
}

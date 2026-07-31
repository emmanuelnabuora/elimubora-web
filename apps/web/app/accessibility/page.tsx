import Link from 'next/link';

export default function AccessibilityPage() {
  return (
    <main className="stub-page">
      <h1>Accessibility</h1>
      <p>
        ElimuBora is being built for keyboard navigation, screen readers, and reduced motion from
        the start. A full accessibility statement, including our conformance target and how to
        report an issue, will be published here.
      </p>
      <Link href="/" className="stub-back">
        &larr; Back to sign in
      </Link>
    </main>
  );
}

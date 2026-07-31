import Link from 'next/link';

export default function LanguagePage() {
  return (
    <main className="stub-page">
      <h1>Language</h1>
      <p>
        ElimuBora is currently available in English. Kiswahili support is planned — this page
        will offer a real language switch once translated content is ready, rather than a toggle
        that doesn&rsquo;t yet do anything.
      </p>
      <Link href="/" className="stub-back">
        &larr; Back to sign in
      </Link>
    </main>
  );
}

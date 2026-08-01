import Link from 'next/link';
import { GlobeIcon, LogoMark } from './icons';

export function SiteHeader({ showHelp = true }: { showHelp?: boolean }) {
  return (
    <header className="site-header">
      <Link href="/" className="site-header-brand">
        <span className="site-header-mark">
          <LogoMark width={20} height={20} />
        </span>
        ElimuBora
      </Link>
      <div className="site-header-actions">
        {showHelp && (
          <Link href="/help" className="pill-button">
            Need help?
          </Link>
        )}
        <Link href="/language" className="pill-button">
          <GlobeIcon width={16} height={16} />
          English
        </Link>
      </div>
    </header>
  );
}

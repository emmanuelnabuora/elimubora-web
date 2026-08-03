import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SiteHeader } from '../../components/SiteHeader';
import { getCurrentUser } from '../../lib/get-current-user';

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const result = await getCurrentUser();
  if (!result) redirect('/');
  if (result.user.role !== 'parent') redirect('/dashboard');

  return (
    <div className="admin-shell">
      <SiteHeader showHelp={false} />
      <div className="admin-body">
        <nav className="admin-sidebar">
          <Link href="/parent" className="admin-nav-link">
            My Children
          </Link>
          <Link href="/parent/announcements" className="admin-nav-link">
            Announcements
          </Link>
        </nav>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}

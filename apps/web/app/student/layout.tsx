import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SiteHeader } from '../../components/SiteHeader';
import { getCurrentUser } from '../../lib/get-current-user';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const result = await getCurrentUser();
  if (!result) redirect('/');
  if (result.user.role !== 'learner') redirect('/dashboard');

  return (
    <div className="admin-shell">
      <SiteHeader showHelp={false} />
      <div className="admin-body">
        <nav className="admin-sidebar">
          <Link href="/student" className="admin-nav-link">
            Overview
          </Link>
          <Link href="/student/assignments" className="admin-nav-link">
            Assignments
          </Link>
          <Link href="/student/homework-help" className="admin-nav-link">
            Homework Help
          </Link>
        </nav>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}

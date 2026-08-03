import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SiteHeader } from '../../components/SiteHeader';
import { getCurrentUser } from '../../lib/get-current-user';

const ADMIN_ROLES = new Set(['school_admin', 'principal', 'platform_admin']);

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const result = await getCurrentUser();
  if (!result) redirect('/');
  if (!ADMIN_ROLES.has(result.user.role)) redirect('/dashboard');

  return (
    <div className="admin-shell">
      <SiteHeader showHelp={false} />
      <div className="admin-body">
        <nav className="admin-sidebar">
          <Link href="/admin" className="admin-nav-link">
            Overview
          </Link>
          <Link href="/admin/students" className="admin-nav-link">
            Students
          </Link>
          <Link href="/admin/leave-requests" className="admin-nav-link">
            Leave Requests
          </Link>
        </nav>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}

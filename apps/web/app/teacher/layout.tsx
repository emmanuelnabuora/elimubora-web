import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SiteHeader } from '../../components/SiteHeader';
import { getCurrentUser } from '../../lib/get-current-user';

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const result = await getCurrentUser();
  if (!result) redirect('/');
  if (result.user.role !== 'teacher') redirect('/dashboard');

  return (
    <div className="admin-shell">
      <SiteHeader showHelp={false} />
      <div className="admin-body">
        <nav className="admin-sidebar">
          <Link href="/teacher" className="admin-nav-link">
            Overview
          </Link>
          <Link href="/teacher/attendance" className="admin-nav-link">
            Attendance
          </Link>
          <Link href="/teacher/grading" className="admin-nav-link">
            Grading
          </Link>
        </nav>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}

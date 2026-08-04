import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../lib/get-current-user';
import { SaShell } from '../../components/SaShell';
import type { SaNavSection } from '../../components/SaSidebarNav';

const ADMIN_ROLES = new Set(['school_admin', 'principal', 'platform_admin']);

const SECTIONS: SaNavSection[] = [
  { items: [{ href: '/admin', label: 'Overview', icon: 'layout-dashboard' }] },
  {
    label: 'ACADEMIC',
    items: [
      { href: '/admin/students', label: 'Students', icon: 'users' },
      { href: '/admin/admissions', label: 'Admissions', icon: 'clipboard-list' },
      { href: '/admin/subjects', label: 'Subjects', icon: 'notebook-pen' },
      { href: '/admin/timetable', label: 'Timetable', icon: 'calendar-clock' }
    ]
  },
  { label: 'FINANCE', items: [{ href: '/admin/fees', label: 'Fees', icon: 'wallet' }] },
  {
    label: 'ADMINISTRATION',
    items: [
      { href: '/admin/staff', label: 'Staff', icon: 'user-cog' },
      { href: '/admin/leave-requests', label: 'Leave Requests', icon: 'clipboard-check' },
      { href: '/admin/logs', label: 'System Logs', icon: 'clipboard-list' }
    ]
  }
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const result = await getCurrentUser();
  if (!result) redirect('/');
  if (!ADMIN_ROLES.has(result.user.role)) redirect('/dashboard');

  const { user } = result;
  const schoolName = user.memberships.find((m) => m.tenantId === user.activeTenantId)?.tenantName ?? 'ElimuBora';
  const roleLabel = user.role === 'school_admin' ? 'School Administrator' : user.role.replace('_', ' ');

  return (
    <SaShell sections={SECTIONS} homeHref="/admin" schoolName={schoolName} fullName={user.fullName} roleLabel={roleLabel}>
      {children}
    </SaShell>
  );
}

import { redirect } from 'next/navigation';
import { LayoutDashboard, Users, UserCog, CalendarClock, Wallet, ClipboardCheck, UserPlus, BookMarked, ScrollText } from 'lucide-react';
import { getCurrentUser } from '../../lib/get-current-user';
import { SaShell } from '../../components/SaShell';
import type { SaNavSection } from '../../components/SaSidebarNav';

const ADMIN_ROLES = new Set(['school_admin', 'principal', 'platform_admin']);

const SECTIONS: SaNavSection[] = [
  { items: [{ href: '/admin', label: 'Overview', icon: LayoutDashboard }] },
  {
    label: 'ACADEMIC',
    items: [
      { href: '/admin/students', label: 'Students', icon: Users },
      { href: '/admin/admissions', label: 'Admissions', icon: UserPlus },
      { href: '/admin/subjects', label: 'Subjects', icon: BookMarked },
      { href: '/admin/timetable', label: 'Timetable', icon: CalendarClock }
    ]
  },
  { label: 'FINANCE', items: [{ href: '/admin/fees', label: 'Fees', icon: Wallet }] },
  {
    label: 'ADMINISTRATION',
    items: [
      { href: '/admin/staff', label: 'Staff', icon: UserCog },
      { href: '/admin/leave-requests', label: 'Leave Requests', icon: ClipboardCheck },
      { href: '/admin/logs', label: 'System Logs', icon: ScrollText }
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

import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../lib/get-current-user';
import { apiFetch } from '../../lib/api-client';
import { SaShell } from '../../components/SaShell';
import type { SaNavSection } from '../../components/SaSidebarNav';

const ADMIN_ROLES = new Set(['school_admin', 'principal', 'platform_admin']);

function buildSections(role: string): SaNavSection[] {
  const sections: SaNavSection[] = [
    { items: [{ href: '/admin', label: 'Overview', icon: 'layout-dashboard' }] }
  ];
  if (role === 'platform_admin') {
    sections.push({
      label: 'PLATFORM',
      items: [{ href: '/admin/tenants', label: 'Onboard an organization', icon: 'building' }]
    });
  }
  sections.push(
    {
      label: 'ACADEMIC',
      items: [
        { href: '/admin/students', label: 'Students', icon: 'users' },
        { href: '/admin/admissions', label: 'Admissions', icon: 'clipboard-list' },
        { href: '/admin/subjects', label: 'Subjects', icon: 'notebook-pen' },
        { href: '/admin/timetable', label: 'Timetable', icon: 'calendar-clock' },
        { href: '/admin/messages', label: 'Messages', icon: 'message-circle' }
      ]
    },
    { label: 'FINANCE', items: [{ href: '/admin/fees', label: 'Fees', icon: 'wallet' }] },
    {
      label: 'ADMINISTRATION',
      items: [
        { href: '/admin/staff', label: 'Staff', icon: 'user-cog' },
        { href: '/admin/leave-requests', label: 'Leave Requests', icon: 'clipboard-check' },
        { href: '/admin/school-settings', label: 'School Settings', icon: 'building' },
        { href: '/admin/logs', label: 'System Logs', icon: 'clipboard-list' }
      ]
    }
  );
  return sections;
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const result = await getCurrentUser();
  if (!result) redirect('/');
  if (!ADMIN_ROLES.has(result.user.role)) redirect('/dashboard');

  const { user } = result;
  const schoolName = user.memberships.find((m) => m.tenantId === user.activeTenantId)?.tenantName ?? 'ElimuBora';
  const roleLabel = user.role === 'school_admin' ? 'School Administrator' : user.role.replace('_', ' ');

  // Failing to fetch the logo shouldn't break the whole dashboard —
  // SaShell already falls back to a generic icon when logoDataUrl is
  // null, so a transient error here degrades gracefully rather than
  // taking down every admin page.
  let logoDataUrl: string | null = null;
  try {
    const tenant = await apiFetch<{ logoDataUrl: string | null }>('/v1/tenants/current');
    logoDataUrl = tenant.logoDataUrl;
  } catch {
    // fall through with no logo
  }

  return (
    <SaShell
      sections={buildSections(user.role)}
      homeHref="/admin"
      schoolName={schoolName}
      fullName={user.fullName}
      roleLabel={roleLabel}
      logoDataUrl={logoDataUrl}
    >
      {children}
    </SaShell>
  );
}

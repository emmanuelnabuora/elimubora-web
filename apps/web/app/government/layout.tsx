import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../lib/get-current-user';
import { SaShell } from '../../components/SaShell';
import type { SaNavSection } from '../../components/SaSidebarNav';

const READ_ROLES = new Set(['county_officer', 'ministry_official', 'platform_admin']);

const SECTIONS: SaNavSection[] = [
  { items: [{ href: '/government', label: 'National Overview', icon: 'layout-dashboard' }] }
];

export default async function GovernmentLayout({ children }: { children: React.ReactNode }) {
  const result = await getCurrentUser();
  if (!result) redirect('/');
  if (!READ_ROLES.has(result.user.role)) redirect('/dashboard');

  const { user } = result;
  const schoolName = user.memberships.find((m) => m.tenantId === user.activeTenantId)?.tenantName ?? 'ElimuBora';
  const roleLabel =
    user.role === 'ministry_official' ? 'Ministry Official' : user.role === 'county_officer' ? 'County Officer' : 'Platform Admin';

  return (
    <SaShell sections={SECTIONS} homeHref="/government" schoolName={schoolName} fullName={user.fullName} roleLabel={roleLabel}>
      {children}
    </SaShell>
  );
}

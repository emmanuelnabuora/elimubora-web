import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../lib/get-current-user';
import { SaShell } from '../../components/SaShell';
import type { SaNavSection } from '../../components/SaSidebarNav';

const SECTIONS: SaNavSection[] = [
  {
    items: [
      { href: '/parent', label: 'My Children', icon: 'users' },
      { href: '/parent/announcements', label: 'Announcements', icon: 'megaphone' }
    ]
  }
];

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const result = await getCurrentUser();
  if (!result) redirect('/');
  if (result.user.role !== 'parent') redirect('/dashboard');

  const { user } = result;
  const schoolName = user.memberships.find((m) => m.tenantId === user.activeTenantId)?.tenantName ?? 'ElimuBora';

  return (
    <SaShell sections={SECTIONS} homeHref="/parent" schoolName={schoolName} fullName={user.fullName} roleLabel="Parent">
      {children}
    </SaShell>
  );
}

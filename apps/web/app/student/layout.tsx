import { redirect } from 'next/navigation';
import { LayoutDashboard, ClipboardList, Sparkles } from 'lucide-react';
import { getCurrentUser } from '../../lib/get-current-user';
import { SaShell } from '../../components/SaShell';
import type { SaNavSection } from '../../components/SaSidebarNav';

const SECTIONS: SaNavSection[] = [
  {
    items: [
      { href: '/student', label: 'Overview', icon: LayoutDashboard },
      { href: '/student/assignments', label: 'Assignments', icon: ClipboardList },
      { href: '/student/homework-help', label: 'Homework Help', icon: Sparkles }
    ]
  }
];

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const result = await getCurrentUser();
  if (!result) redirect('/');
  if (result.user.role !== 'learner') redirect('/dashboard');

  const { user } = result;
  const schoolName = user.memberships.find((m) => m.tenantId === user.activeTenantId)?.tenantName ?? 'ElimuBora';

  return (
    <SaShell sections={SECTIONS} homeHref="/student" schoolName={schoolName} fullName={user.fullName} roleLabel="Student">
      {children}
    </SaShell>
  );
}

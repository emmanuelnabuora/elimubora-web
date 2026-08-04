import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../lib/get-current-user';
import { SaShell } from '../../components/SaShell';
import type { SaNavSection } from '../../components/SaSidebarNav';

const SECTIONS: SaNavSection[] = [
  {
    items: [
      { href: '/teacher', label: 'Overview', icon: 'layout-dashboard' },
      { href: '/teacher/attendance', label: 'Attendance', icon: 'calendar-check' },
      { href: '/teacher/grading', label: 'Grading', icon: 'graduation-cap' },
      { href: '/teacher/lesson-plans', label: 'Lesson Plans', icon: 'notebook-pen' }
    ]
  }
];

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const result = await getCurrentUser();
  if (!result) redirect('/');
  if (result.user.role !== 'teacher') redirect('/dashboard');

  const { user } = result;
  const schoolName = user.memberships.find((m) => m.tenantId === user.activeTenantId)?.tenantName ?? 'ElimuBora';

  return (
    <SaShell sections={SECTIONS} homeHref="/teacher" schoolName={schoolName} fullName={user.fullName} roleLabel="Teacher">
      {children}
    </SaShell>
  );
}

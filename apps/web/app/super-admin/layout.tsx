import { redirect } from 'next/navigation';

import { SuperAdminShell } from '../../components/super-admin/SuperAdminShell';
import { getCurrentUser } from '../../lib/get-current-user';

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentUser();
  if (!session) redirect('/');
  if (session.user.role !== 'platform_admin') redirect('/dashboard');

  const environment = process.env.NODE_ENV === 'production' ? 'Production' : 'Development';

  return (
    <SuperAdminShell fullName={session.user.fullName} environment={environment}>
      {children}
    </SuperAdminShell>
  );
}

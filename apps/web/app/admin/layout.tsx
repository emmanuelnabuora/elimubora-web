import { redirect } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Building2 } from 'lucide-react';
import { getCurrentUser } from '../../lib/get-current-user';
import { SaSidebarNav } from './SaSidebarNav';
import { SaLogoutButton } from './SaLogoutButton';

const ADMIN_ROLES = new Set(['school_admin', 'principal', 'platform_admin']);

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const result = await getCurrentUser();
  if (!result) redirect('/');
  if (!ADMIN_ROLES.has(result.user.role)) redirect('/dashboard');

  const { user } = result;
  const activeMembership = user.memberships.find((m) => m.tenantId === user.activeTenantId);
  const schoolName = activeMembership?.tenantName ?? 'ElimuBora';
  const roleLabel = user.role.replace('_', ' ');

  return (
    <div className="sa-shell">
      <aside className="sa-sidebar">
        <Link href="/admin" className="sa-sidebar-brand">
          <BookOpen size={26} />
          <span className="sa-sidebar-brand-text">
            <span className="sa-sidebar-brand-name">ElimuBora</span>
            <span className="sa-sidebar-brand-tagline">Empowering Education</span>
          </span>
        </Link>

        <SaSidebarNav />

        <div className="sa-sidebar-footer">
          <div className="sa-institution-card">
            <Building2 size={18} />
            {schoolName}
          </div>
          <SaLogoutButton />
        </div>
      </aside>

      <div className="sa-main">
        <header className="sa-header">
          <div className="sa-header-identity">
            <Building2 size={20} />
            <div>
              <p className="sa-header-school">{schoolName}</p>
              <p className="sa-header-role" style={{ textTransform: 'capitalize' }}>
                School {roleLabel === 'school admin' ? 'Administrator' : roleLabel}
              </p>
            </div>
          </div>
          <div className="sa-user-menu">
            <div className="sa-avatar">{initials(user.fullName)}</div>
            <div>
              <p className="sa-user-name">{user.fullName}</p>
              <p className="sa-user-role" style={{ textTransform: 'capitalize' }}>
                {roleLabel}
              </p>
            </div>
          </div>
        </header>

        <main className="sa-content">{children}</main>
      </div>
    </div>
  );
}

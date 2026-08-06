import Link from 'next/link';
import { BookOpen, Building2 } from 'lucide-react';
import { SaSidebarNav, type SaNavSection } from './SaSidebarNav';
import { SaLogoutButton } from './SaLogoutButton';

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function SaShell({
  sections,
  homeHref,
  schoolName,
  fullName,
  roleLabel,
  logoDataUrl,
  children
}: {
  sections: SaNavSection[];
  homeHref: string;
  schoolName: string;
  fullName: string;
  roleLabel: string;
  logoDataUrl?: string | null;
  children: React.ReactNode;
}) {
  const SchoolMark = ({ size }: { size: number }) =>
    logoDataUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoDataUrl}
        alt=""
        style={{ width: size, height: size, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
      />
    ) : (
      <Building2 size={size} />
    );

  return (
    <div className="sa-shell">
      <aside className="sa-sidebar">
        <Link href={homeHref} className="sa-sidebar-brand">
          <BookOpen size={26} />
          <span className="sa-sidebar-brand-text">
            <span className="sa-sidebar-brand-name">ElimuBora</span>
            <span className="sa-sidebar-brand-tagline">Empowering Education</span>
          </span>
        </Link>

        <SaSidebarNav sections={sections} />

        <div className="sa-sidebar-footer">
          <div className="sa-institution-card">
            <SchoolMark size={18} />
            {schoolName}
          </div>
          <SaLogoutButton />
        </div>
      </aside>

      <div className="sa-main">
        <header className="sa-header">
          <div className="sa-header-identity">
            <SchoolMark size={20} />
            <div>
              <p className="sa-header-school">{schoolName}</p>
              <p className="sa-header-role" style={{ textTransform: 'capitalize' }}>
                {roleLabel}
              </p>
            </div>
          </div>
          <div className="sa-user-menu">
            <div className="sa-avatar">{initials(fullName)}</div>
            <div>
              <p className="sa-user-name">{fullName}</p>
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

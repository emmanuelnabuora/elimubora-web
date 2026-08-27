import Link from 'next/link';
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  Building2,
  ClipboardCheck,
  Code2,
  Database,
  Headphones,
  KeyRound,
  LockKeyhole,
  Megaphone,
  Network,
  ServerCog,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  WalletCards
} from 'lucide-react';

import { SaLogoutButton } from '../SaLogoutButton';
import styles from './super-admin.module.css';

const nav = [
  ['Overview', '/super-admin', Activity],
  ['Institutions', '/super-admin/institutions', Building2],
  ['School Applications', '/super-admin/school-applications', ClipboardCheck],
  ['Users & Identity', '/super-admin/users', Users],
  ['Roles & Access', '/super-admin/access', KeyRound],
  ['Platform Operations', '/super-admin/operations', ServerCog],
  ['Billing & Plans', '/super-admin/billing', WalletCards],
  ['Integrations', '/super-admin/integrations', Network],
  ['Security', '/super-admin/security', ShieldCheck],
  ['Audit & Compliance', '/super-admin/audit', LockKeyhole],
  ['Analytics', '/super-admin/analytics', BarChart3],
  ['AI Governance', '/super-admin/ai', Sparkles],
  ['Communications', '/super-admin/communications', Megaphone],
  ['Support', '/super-admin/support', Headphones],
  ['Feature Management', '/super-admin/features', SlidersHorizontal],
  ['System Configuration', '/super-admin/settings', Settings],
  ['Developer Platform', '/super-admin/developers', Code2],
  ['Infrastructure', '/super-admin/infrastructure', Boxes],
  ['Data Management', '/super-admin/data', Database]
] as const;

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
}

export function SuperAdminShell({
  fullName,
  environment,
  children
}: {
  fullName: string;
  environment: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/super-admin" className={styles.brand}>
          <BookOpen size={32} />
          <span><strong>ElimuBora</strong><small>SUPER ADMIN</small></span>
        </Link>
        <nav className={styles.nav} aria-label="Super admin navigation">
          {nav.map(([label, href, Icon]) => (
            <Link key={href} href={href} className={styles.navItem}>
              <Icon size={18} />
              <span>{label}</span>
              {label !== 'Overview' && <span className={styles.chevron}>›</span>}
            </Link>
          ))}
        </nav>
        <div className={styles.profileCard}>
          <span className={styles.avatar}>{initials(fullName)}</span>
          <span><strong>{fullName}</strong><small>Platform Administrator</small></span>
        </div>
        <SaLogoutButton />
      </aside>
      <section className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1>Platform Overview</h1>
            <p>Welcome back, {fullName.split(' ')[0]}</p>
          </div>
          <div className={styles.headerActions}>
            {/*
              A real environment badge (from actual server config), not a
              hardcoded string -- and no global search box or notification
              counter here: neither has a real implementation behind it yet
              (no cross-entity search endpoint, no notification system),
              and a search box that silently does nothing when you type in
              it, or a bell showing a number with no real notifications
              behind it, is worse than not having one at all.
            */}
            <button type="button" className={styles.environment}>
              <ServerCog size={16} /> {environment}
            </button>
            <button type="button" className={styles.iconButton} aria-label="Notifications">
              <Bell size={19} />
            </button>
            <button type="button" className={styles.userButton}>
              <span className={styles.avatar}>{initials(fullName)}</span>
              <span>Super Admin</span>
            </button>
          </div>
        </header>
        <main className={styles.content}>{children}</main>
      </section>
    </div>
  );
}

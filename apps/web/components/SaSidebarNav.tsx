'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarCheck,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  NotebookPen,
  Sparkles,
  UserCog,
  Users,
  Wallet,
  type LucideIcon
} from 'lucide-react';

export type SaIconName =
  | 'layout-dashboard'
  | 'users'
  | 'calendar-clock'
  | 'wallet'
  | 'user-cog'
  | 'clipboard-check'
  | 'clipboard-list'
  | 'sparkles'
  | 'megaphone'
  | 'calendar-check'
  | 'graduation-cap'
  | 'notebook-pen';

export interface SaNavItem {
  href: string;
  label: string;
  icon: SaIconName;
}

export interface SaNavSection {
  label?: string;
  items: SaNavItem[];
}

const ICONS: Record<SaIconName, LucideIcon> = {
  'layout-dashboard': LayoutDashboard,
  users: Users,
  'calendar-clock': CalendarClock,
  wallet: Wallet,
  'user-cog': UserCog,
  'clipboard-check': ClipboardCheck,
  'clipboard-list': ClipboardList,
  sparkles: Sparkles,
  megaphone: Megaphone,
  'calendar-check': CalendarCheck,
  'graduation-cap': GraduationCap,
  'notebook-pen': NotebookPen
};

export function SaSidebarNav({ sections }: { sections: SaNavSection[] }) {
  const pathname = usePathname();

  return (
    <>
      {sections.map((section, i) => (
        <div key={section.label ?? i}>
          {section.label && (
            <p className="sa-nav-section-label">{section.label}</p>
          )}

          {section.items.map((item) => {
            const Icon = ICONS[item.icon];
            const isActive =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sa-nav-item${isActive ? ' active' : ''}`}
              >
                <Icon aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}

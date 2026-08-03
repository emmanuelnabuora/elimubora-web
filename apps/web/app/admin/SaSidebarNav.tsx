'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, UserCog, CalendarClock, Wallet, ClipboardCheck } from 'lucide-react';

const NAV_SECTIONS = [
  {
    items: [{ href: '/admin', label: 'Overview', icon: LayoutDashboard }]
  },
  {
    label: 'ACADEMIC',
    items: [
      { href: '/admin/students', label: 'Students', icon: Users },
      { href: '/admin/timetable', label: 'Timetable', icon: CalendarClock }
    ]
  },
  {
    label: 'FINANCE',
    items: [{ href: '/admin/fees', label: 'Fees', icon: Wallet }]
  },
  {
    label: 'ADMINISTRATION',
    items: [
      { href: '/admin/staff', label: 'Staff', icon: UserCog },
      { href: '/admin/leave-requests', label: 'Leave Requests', icon: ClipboardCheck }
    ]
  }
];

export function SaSidebarNav() {
  const pathname = usePathname();

  return (
    <>
      {NAV_SECTIONS.map((section, i) => (
        <div key={i}>
          {section.label && <p className="sa-nav-section-label">{section.label}</p>}
          {section.items.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className={`sa-nav-item${isActive ? ' active' : ''}`}>
                <Icon />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}

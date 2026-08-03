'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';

export interface SaNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface SaNavSection {
  label?: string;
  items: SaNavItem[];
}

export function SaSidebarNav({ sections }: { sections: SaNavSection[] }) {
  const pathname = usePathname();

  return (
    <>
      {sections.map((section, i) => (
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

'use client';

import { useState } from 'react';
import { LoginForm } from '../app/login/[role]/LoginForm';
import { ROLE_CONFIG } from '../lib/roles';

const TAB_ROLES = ['student', 'teacher', 'parent', 'admin'] as const;
const TAB_LABELS: Record<(typeof TAB_ROLES)[number], string> = {
  student: 'Student',
  teacher: 'Teacher',
  parent: 'Parent',
  admin: 'Administrator'
};

/**
 * The landing page's login panel. Reuses the exact same LoginForm
 * component and submission logic as /login/[role] — the "existing
 * login flow" this was built to preserve — just switching which
 * role's config gets passed in based on the selected tab, instead of
 * navigating to a separate per-role route. LoginForm's embedded prop
 * (added alongside this, default false) skips its own outer card
 * wrapper and redundant heading so this panel's card is the only one,
 * matching the mockup's single unified card containing both the role
 * tabs and the form — the per-role pages at /login/[role] are
 * completely unaffected, since they never pass embedded.
 */
export function LandingLoginPanel() {
  const [active, setActive] = useState<(typeof TAB_ROLES)[number]>('student');
  const role = ROLE_CONFIG[active]!;

  return (
    <div className="auth-card" style={{ ['--door-accent' as string]: role.accent }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--ds-space-lg, 24px)' }}>
        <h2 style={{ margin: '0 0 4px' }}>Welcome back!</h2>
        <p className="auth-desc" style={{ margin: 0 }}>
          Sign in to access your ElimuBora portal
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Choose your role"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 'var(--ds-space-lg, 24px)'
        }}
      >
        {TAB_ROLES.map((slug) => {
          const isActive = slug === active;
          const TabIcon = ROLE_CONFIG[slug]!.icon;
          return (
            <button
              key={slug}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(slug)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                width: 96,
                height: 96,
                flexShrink: 0,
                padding: 16,
                borderRadius: 16,
                border: isActive ? '1.5px solid var(--eb-primary)' : '1px solid var(--eb-line)',
                background: isActive ? 'var(--eb-green-100)' : 'var(--eb-surface)',
                color: isActive ? 'var(--eb-primary)' : 'var(--eb-fg-muted)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                transition: 'transform 250ms ease, background-color 250ms ease, border-color 250ms ease'
              }}
            >
              <TabIcon width={28} height={28} />
              {TAB_LABELS[slug]}
            </button>
          );
        })}
      </div>

      <LoginForm
        key={active}
        embedded
        role={{
          slug: role.slug,
          label: role.label,
          doorDesc: role.doorDesc,
          accent: role.accent,
          welcomeEmoji: role.welcomeEmoji,
          welcomeLede: role.welcomeLede,
          features: role.features,
          contactNote: role.contactNote
        }}
      />
    </div>
  );
}

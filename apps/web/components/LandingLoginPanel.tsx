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
    <div className="auth-card" style={{ maxWidth: 420, ['--door-accent' as string]: role.accent }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--eb-space-4)' }}>
        <h2 style={{ margin: '0 0 4px' }}>Sign in to your account</h2>
        <p className="auth-desc" style={{ margin: 0 }}>
          Access your ElimuBora portal
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Choose your role"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
          marginBottom: 'var(--eb-space-4)'
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
                gap: 6,
                padding: '10px 6px',
                borderRadius: 10,
                border: isActive ? '1.5px solid var(--eb-primary)' : '1px solid var(--eb-line)',
                background: isActive ? 'var(--eb-green-100)' : 'var(--eb-surface)',
                color: isActive ? 'var(--eb-primary)' : 'var(--eb-fg-muted)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600
              }}
            >
              <TabIcon width={18} height={18} />
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

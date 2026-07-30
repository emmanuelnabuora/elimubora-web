/**
 * Design token names exported for typed consumption (charts, emails,
 * mobile token generation). The CSS itself lives in tokens.css.
 */
export const tokens = {
  color: {
    bg: 'var(--eb-bg)',
    fg: 'var(--eb-fg)',
    fgMuted: 'var(--eb-fg-muted)',
    primary: 'var(--eb-primary)',
    danger: 'var(--eb-danger)',
    focus: 'var(--eb-focus)'
  },
  radius: { sm: 'var(--eb-radius-sm)', md: 'var(--eb-radius-md)' },
  font: {
    display: 'var(--eb-font-display)',
    body: 'var(--eb-font-body)',
    mono: 'var(--eb-font-mono)'
  }
} as const;

export type Tokens = typeof tokens;

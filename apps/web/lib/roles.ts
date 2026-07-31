export interface RoleConfig {
  slug: string;
  label: string;
  heading: string;
  accent: string;
}

export const ROLE_CONFIG: Record<string, RoleConfig> = {
  teacher: {
    slug: 'teacher',
    label: 'Teacher',
    heading: 'Sign in to plan lessons, grade work, and mark attendance.',
    accent: 'var(--eb-primary)'
  },
  student: {
    slug: 'student',
    label: 'Student',
    heading: 'Sign in to see your assignments, exams, and grades.',
    accent: 'var(--eb-primary)'
  },
  parent: {
    slug: 'parent',
    label: 'Parent',
    heading: 'Sign in to follow attendance, fees, and progress.',
    accent: 'var(--eb-primary)'
  },
  admin: {
    slug: 'admin',
    label: 'School Administrator',
    heading: 'Sign in to manage enrolment, staff, and finance.',
    accent: 'var(--eb-ink-900)'
  },
  ministry: {
    slug: 'ministry',
    label: 'Ministry, County & Partner',
    heading: 'Sign in to view county and national reporting.',
    accent: 'var(--eb-ink-900)'
  }
};

export function isValidRole(slug: string): boolean {
  return slug in ROLE_CONFIG;
}

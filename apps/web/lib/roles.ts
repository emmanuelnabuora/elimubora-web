import type { ComponentType, SVGProps } from 'react';
import { AdminIcon, MinistryIcon, ParentIcon, StudentIcon, TeacherIcon } from '../components/icons';

export interface RoleConfig {
  slug: string;
  label: string;
  doorDesc: string;
  accent: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  welcomeEmoji: string;
  welcomeLede: string;
  features: string[];
  contactNote: string;
  /**
   * Where contactNote's action text links to. Defaults to /help in
   * LoginForm when omitted -- only the admin door overrides this,
   * since "don't have an account" for a school administrator usually
   * means the school itself isn't onboarded yet, not a forgotten
   * individual login. Every other role's absence of an account is a
   * genuine support question (a student/teacher/parent whose school
   * hasn't set them up), so those keep pointing at /help.
   */
  contactHref?: string;
}

export const ROLE_CONFIG: Record<string, RoleConfig> = {
  teacher: {
    slug: 'teacher',
    label: 'Teacher',
    doorDesc: 'Plan lessons, grade submissions, and track attendance.',
    accent: 'var(--eb-primary)',
    icon: TeacherIcon,
    welcomeEmoji: '\u{1F44B}',
    welcomeLede: 'Inspire, teach, and empower the next generation.',
    features: ['Create engaging lessons', 'Track student progress', 'Manage your classroom'],
    contactNote: "Don't have an account? Contact your school administrator."
  },
  student: {
    slug: 'student',
    label: 'Student',
    doorDesc: 'Access lessons, take exams, and get homework help.',
    accent: 'var(--eb-primary)',
    icon: StudentIcon,
    welcomeEmoji: '\u{1F4DA}',
    welcomeLede: 'Keep learning. Keep growing. Your future starts here.',
    features: ['Access learning materials', 'Submit and track assignments', 'Take quizzes and exams'],
    contactNote: "Don't have an account? Contact your school."
  },
  parent: {
    slug: 'parent',
    label: 'Parent',
    doorDesc: "Monitor attendance, fees, and your child's progress.",
    accent: 'var(--eb-primary)',
    icon: ParentIcon,
    welcomeEmoji: '\u2764\uFE0F',
    welcomeLede: "Stay connected. Stay informed. Support your child's journey.",
    features: ['Check attendance', 'View progress reports', 'Manage fees and payments'],
    contactNote: "Don't have an account? Contact your child's school."
  },
  admin: {
    slug: 'admin',
    label: 'School Administrator',
    doorDesc: 'Manage enrolment, staff, academics, and school operations.',
    accent: 'var(--eb-primary)',
    icon: AdminIcon,
    welcomeEmoji: '\u{1F3E2}',
    welcomeLede: 'Manage with efficiency. Lead with insight.',
    features: ['Manage staff and students', 'Oversee academics', 'View reports and analytics'],
    contactNote: "Don't have an account? Apply to onboard your school.",
    contactHref: '/apply'
  },
  ministry: {
    slug: 'ministry',
    label: 'Ministry / County / Partner',
    doorDesc: 'View reports, oversight, and partner collaboration.',
    accent: 'var(--eb-primary)',
    icon: MinistryIcon,
    welcomeEmoji: '\u{1F3DB}\uFE0F',
    welcomeLede: 'County and national insight, in one place.',
    features: ['National and county analytics', 'Policy monitoring', 'Cross-institution reporting'],
    contactNote: 'Access is provisioned by the Ministry of Education.'
  }
};

export function isValidRole(slug: string): boolean {
  return slug in ROLE_CONFIG;
}

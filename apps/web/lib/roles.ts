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
    accent: 'var(--eb-ink-900)',
    icon: AdminIcon,
    welcomeEmoji: '\u{1F3E2}',
    welcomeLede: 'Manage with efficiency. Lead with insight.',
    features: ['Manage staff and students', 'Oversee academics', 'View reports and analytics'],
    contactNote: "Don't have an account? Contact your system administrator."
  },
  ministry: {
    slug: 'ministry',
    label: 'Ministry / County / Partner',
    doorDesc: 'View reports, oversight, and partner collaboration.',
    accent: 'var(--eb-ink-900)',
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

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;
const base = (props: IconProps) => ({
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...props
});

/** The logo mark: an open book with a sprouting leaf — growth through learning. */
export function LogoMark(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 6.5C10.3 5.1 7.8 4.4 5 4.4v13.2c2.8 0 5.3.7 7 2.1 1.7-1.4 4.2-2.1 7-2.1V4.4c-2.8 0-5.3.7-7 2.1Z" />
      <path d="M12 6.5v13.2" />
      <circle cx="12" cy="3.2" r="1.4" fill="var(--eb-accent)" stroke="none" />
    </svg>
  );
}

export function TeacherIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="4" width="14" height="10" rx="1.2" />
      <path d="M6 17.5c0-1.9 2-3 4-3s4 1.1 4 3" />
      <circle cx="10" cy="12.2" r="1.6" />
      <path d="M20 8v6" />
    </svg>
  );
}

export function StudentIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5 3 9l9 4 9-4-9-4Z" />
      <path d="M7 11.2v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4" />
      <path d="M20 9v5.5" />
    </svg>
  );
}

export function ParentIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="9" cy="7" r="2.4" />
      <circle cx="17" cy="8.5" r="1.8" />
      <path d="M4.5 19c0-2.8 2-4.6 4.5-4.6s4.5 1.8 4.5 4.6" />
      <path d="M14.5 19c0-1.9-.6-3.4-1.8-4.3.6-.5 1.4-.8 2.3-.8 2 0 3.5 1.5 3.5 3.9" />
    </svg>
  );
}

export function AdminIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 20V9l8-5 8 5v11" />
      <path d="M4 20h16" />
      <rect x="9.5" y="12" width="5" height="8" />
      <path d="M9 9h.01M15 9h.01" strokeWidth={2.2} />
    </svg>
  );
}

export function MinistryIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.5c2 1.3 4.3 2 6.5 2-.2 6.5-2.6 10.7-6.5 13-3.9-2.3-6.3-6.5-6.5-13 2.2 0 4.5-.7 6.5-2Z" />
      <path d="m9.3 12 1.9 1.9 3.5-3.9" />
    </svg>
  );
}

export function GraduationCapIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2 9.5 12 5l10 4.5-10 4.5-10-4.5Z" />
      <path d="M6 11.5v4.3c0 1 2.7 2.7 6 2.7s6-1.7 6-2.7v-4.3" />
      <path d="M20 9.5v5.5" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.5c2 1.3 4.3 2 6.5 2-.2 6.5-2.6 10.7-6.5 13-3.9-2.3-6.3-6.5-6.5-13 2.2 0 4.5-.7 6.5-2Z" />
    </svg>
  );
}

export function DeviceIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="4.5" width="18" height="12" rx="1.4" />
      <path d="M8.5 20h7M12 16.5V20" />
    </svg>
  );
}

export function FlagIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 3v18" />
      <path d="M5 4.5h14l-3 3.5 3 3.5H5" />
    </svg>
  );
}

export function TrophyIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 4h10v4.5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5.5H4v1.5A3.5 3.5 0 0 0 7 10.4M17 5.5h3v1.5A3.5 3.5 0 0 1 17 10.4" />
      <path d="M12 13.5V17M9 20h6M8.5 17h7" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base(props)} strokeWidth={2}>
      <path d="M5 12.5 9.5 17 19 7" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...base(props)} strokeWidth={2}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function ExternalLinkIcon(props: IconProps) {
  return (
    <svg {...base(props)} strokeWidth={1.8}>
      <path d="M14 4h6v6" />
      <path d="M20 4 10 14" />
      <path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...base(props)} strokeWidth={2}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function HelpIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.2a2.5 2.5 0 0 1 4.8.9c0 1.7-2.3 1.9-2.3 3.4" />
      <circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.3 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.3-3.6-8.5S9.6 5.8 12 3.5Z" />
    </svg>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="1.8" />
      <path d="M7.5 10.5V7.8a4.5 4.5 0 0 1 9 0v2.7" />
    </svg>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2.5 12s3.7-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.7 6.5-9.5 6.5S2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}

export function EyeOffIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 3l18 18" />
      <path d="M7.4 7.6C4.6 9 2.5 12 2.5 12s3.7 6.5 9.5 6.5c1.6 0 3.1-.5 4.4-1.2M10.6 5.6c.5-.1 1-.1 1.4-.1 5.8 0 9.5 6.5 9.5 6.5s-.8 1.5-2.4 3" />
      <path d="M9.7 9.8a2.8 2.8 0 0 0 4 4" />
    </svg>
  );
}

export function BuildingIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 21V7.2l7-3.5 7 3.5V21" />
      <path d="M3 21h18M9.5 21v-4.5h5V21M9.5 9.8h.01M14.5 9.8h.01M9.5 13.3h.01M14.5 13.3h.01" />
    </svg>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="8.5" cy="7.5" r="3" />
      <path d="M3 20v-1.8A4.8 4.8 0 0 1 7.8 13.4h1.4a4.8 4.8 0 0 1 4.8 4.8V20" />
      <circle cx="17" cy="9" r="2.3" />
      <path d="M15.2 13.9a4 4 0 0 1 5.3 3.8V20" />
    </svg>
  );
}

export function ChalkboardIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M3 16 8.5 21M21 16 15.5 21M8.5 11.5l2.5-3 2.3 2 3-3.5" />
    </svg>
  );
}

export function ParentGroupIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="9.5" cy="7" r="2.9" />
      <path d="M4 20v-1.6a5 5 0 0 1 5-5h1a5 5 0 0 1 5 5V20" />
      <circle cx="18" cy="10.5" r="1.9" />
      <path d="M15.3 20v-1a3.2 3.2 0 0 1 5.6-2.2" />
    </svg>
  );
}

/** Standard multi-colour "G" mark — the conventional way any product signals Google sign-in. */
export function GoogleLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" {...props}>
      <path fill="#4285F4" d="M17.6 9.2c0-.6-.05-1.2-.15-1.8H9v3.4h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5Z" />
      <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 5.9-2.2l-2.9-2.2c-.8.5-1.8.9-3 .9-2.3 0-4.3-1.6-5-3.7H1v2.3A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M4 10.8a5.4 5.4 0 0 1 0-3.5V5H1a9 9 0 0 0 0 8l3-2.2Z" />
      <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.5A9 9 0 0 0 1 5l3 2.3C4.7 5.2 6.7 3.6 9 3.6Z" />
    </svg>
  );
}

/** Standard four-square mark — the conventional way any product signals Microsoft sign-in. */
export function MicrosoftLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" {...props}>
      <rect x="1" y="1" width="7.5" height="7.5" fill="#F35325" />
      <rect x="9.5" y="1" width="7.5" height="7.5" fill="#81BC06" />
      <rect x="1" y="9.5" width="7.5" height="7.5" fill="#05A6F0" />
      <rect x="9.5" y="9.5" width="7.5" height="7.5" fill="#FFBA08" />
    </svg>
  );
}

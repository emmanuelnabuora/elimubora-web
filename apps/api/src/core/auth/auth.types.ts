/** Institutional roles carried by memberships and access tokens. */
export const MEMBERSHIP_ROLES = [
  'learner',
  'teacher',
  'parent',
  'school_admin',
  'principal',
  'county_officer',
  'ministry_official',
  'platform_admin'
] as const;

export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

/** Principal attached to the request by the global JWT guard. */
export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  role: MembershipRole;
  sessionId: string;
}

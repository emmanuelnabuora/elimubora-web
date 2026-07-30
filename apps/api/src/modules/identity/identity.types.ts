export {
  MEMBERSHIP_ROLES,
  type AuthenticatedUser,
  type MembershipRole
} from '../../core/auth/auth.types';
import type { MembershipRole } from '../../core/auth/auth.types';

export interface UserRecord {
  id: string;
  email: string;
  fullName: string;
  passwordHash: string;
  status: 'active' | 'suspended';
  failedAttempts: number;
  lockedUntil: Date | null;
  totpSecretEnc: string | null;
  totpEnabled: boolean;
}

export interface MembershipRecord {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  role: MembershipRole;
}

export interface AccessTokenClaims {
  sub: string;
  ten: string;
  rol: MembershipRole;
  sid: string;
  typ: 'access' | 'mfa';
}

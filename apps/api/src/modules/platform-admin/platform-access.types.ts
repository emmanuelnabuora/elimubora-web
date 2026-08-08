export type AccessScopeType = 'global' | 'county' | 'institution' | 'resource';
export type AccessRiskLevel = 'standard' | 'elevated' | 'critical';

export interface PlatformPermissionRow {
  id: string;
  key: string;
  description: string;
  category: string;
  requiresStepUp: boolean;
}

export interface PlatformRoleRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  riskLevel: AccessRiskLevel;
  isSystem: boolean;
  permissions: string[];
}

export interface PlatformAccessGrantRow {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  roleKey: string;
  roleName: string;
  scopeType: AccessScopeType;
  scopeId: string | null;
  status: 'active' | 'revoked' | 'expired';
  startsAt: string;
  expiresAt: string | null;
  reason: string;
  grantedBy: string;
}

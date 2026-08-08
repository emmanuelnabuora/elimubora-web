export type InstitutionStatus = 'active' | 'suspended' | 'archived';
export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';
export type SupportStatus = 'new' | 'assigned' | 'waiting' | 'escalated' | 'resolved' | 'closed';

export interface PlatformInstitution {
  id: string;
  name: string;
  slug: string;
  kind: string;
  countyCode: string | null;
  nemisCode: string | null;
  status: InstitutionStatus;
  createdAt: string;
}

export interface PlatformUserRow {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: string;
  totpEnabled: boolean;
  roles: Array<{ tenantId: string; tenantName: string; role: string; status: string }>;
  createdAt: string;
}

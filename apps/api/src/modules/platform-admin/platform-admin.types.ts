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

export interface InstitutionAdminContact {
  id: string;
  fullName: string;
  email: string;
  role: string;
  joinedAt: string;
}

export interface InstitutionPendingInvite {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
}

export interface InstitutionClassStreamGroup {
  gradeLevel: string;
  academicYear: number;
  streamNames: string[];
  streamCount: number;
}

export interface PlatformInstitutionOverview extends PlatformInstitution {
  settings: Record<string, unknown>;
  enrollment: {
    students: number;
    teachers: number;
    parents: number;
    schoolAdmins: number;
    principals: number;
  };
  adminContacts: InstitutionAdminContact[];
  pendingAdminInvites: InstitutionPendingInvite[];
  classStreams: InstitutionClassStreamGroup[];
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

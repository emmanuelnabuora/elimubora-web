/** Institutional kinds recognised in the Kenyan education system. */
export type TenantKind =
  | 'school'
  | 'county'
  | 'university'
  | 'tvet'
  | 'ministry'
  | 'partner';

export type TenantStatus = 'active' | 'suspended' | 'archived';

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  kind: TenantKind;
  /** IEBC/ISO county code, e.g. '047' for Nairobi. */
  countyCode: string | null;
  /** NEMIS institution code where applicable. */
  nemisCode: string | null;
  status: TenantStatus;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

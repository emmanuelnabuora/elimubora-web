import { getUser } from '@netlify/identity';

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  totpEnabled: boolean;
  activeTenantId: string;
  role: string;
  memberships: Array<{ tenantId: string; tenantSlug: string; tenantName: string; role: string }>;
}

export async function getCurrentUser(): Promise<{ user: CurrentUser } | null> {
  const identityUser = await getUser();
  if (!identityUser) return null;

  const role = identityUser.roles?.[0] ?? identityUser.role ?? 'user';
  return {
    user: {
      id: identityUser.id,
      email: identityUser.email ?? '',
      fullName: identityUser.name ?? identityUser.email ?? 'ElimuBora user',
      totpEnabled: false,
      activeTenantId: '',
      role,
      memberships: []
    }
  };
}

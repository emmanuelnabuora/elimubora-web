import { ForbiddenException } from '@nestjs/common';
import { PlatformAccessService } from './platform-access.service';

describe('PlatformAccessService', () => {
  const repository = {
    roles: jest.fn(), permissions: jest.fn(), grants: jest.fn(), privilegedSessions: jest.fn(), impersonationRequests: jest.fn(),
    createRole: jest.fn(), updateRolePermissions: jest.fn(), createGrant: jest.fn(), revokeGrant: jest.fn(),
    revokePrivilegedSession: jest.fn(), createImpersonationRequest: jest.fn(), closeImpersonationRequest: jest.fn(), effectivePermissions: jest.fn()
  } as any;
  const service = new PlatformAccessService(repository);
  const admin = { userId:'00000000-0000-0000-0000-000000000001', tenantId:'00000000-0000-0000-0000-000000000002', role:'platform_admin' } as any;
  const teacher = { ...admin, role:'teacher' } as any;

  beforeEach(() => jest.clearAllMocks());

  it('rejects non platform administrators', async () => {
    expect(() => service.roles(teacher)).toThrow(ForbiddenException);
  });

  it('uses bootstrap root permissions when the platform admin has no explicit grants', async () => {
    repository.effectivePermissions.mockResolvedValue([]);
    repository.permissions.mockResolvedValue([{ key:'institution.read' }, { key:'access.grants.manage' }]);
    await expect(service.effectivePermissions(admin)).resolves.toEqual({
      userId: admin.userId, bootstrapRoot: true, permissions:['institution.read','access.grants.manage']
    });
  });

  it('never allows self impersonation', async () => {
    await expect(service.requestImpersonation(admin, {
      targetUserId: admin.userId, reason:'Investigate an authenticated support case'
    } as any)).rejects.toThrow();
    expect(repository.createImpersonationRequest).not.toHaveBeenCalled();
  });
});

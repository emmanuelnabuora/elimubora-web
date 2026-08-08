import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import type {
  CreateGrantDto, CreateRoleDto, ImpersonationDecisionDto, ImpersonationRequestDto,
  RevokeGrantDto, RevokePrivilegedSessionDto, UpdateRolePermissionsDto
} from './platform-access.dto';
import { PlatformAccessRepository } from './platform-access.repository';

@Injectable()
export class PlatformAccessService {
  constructor(private readonly repository: PlatformAccessRepository) {}

  private assertPlatformAdmin(user: AuthenticatedUser): void {
    if (user.role !== 'platform_admin') throw new ForbiddenException('Platform administrator access required');
  }

  permissions(user: AuthenticatedUser) { this.assertPlatformAdmin(user); return this.repository.permissions(); }
  roles(user: AuthenticatedUser) { this.assertPlatformAdmin(user); return this.repository.roles(); }
  grants(user: AuthenticatedUser) { this.assertPlatformAdmin(user); return this.repository.grants(); }
  privilegedSessions(user: AuthenticatedUser) { this.assertPlatformAdmin(user); return this.repository.privilegedSessions(); }
  impersonationRequests(user: AuthenticatedUser) { this.assertPlatformAdmin(user); return this.repository.impersonationRequests(); }

  async createRole(user: AuthenticatedUser, dto: CreateRoleDto) {
    this.assertPlatformAdmin(user);
    return this.repository.createRole(user.userId, user.tenantId, dto);
  }

  async updateRolePermissions(user: AuthenticatedUser, roleId: string, dto: UpdateRolePermissionsDto) {
    this.assertPlatformAdmin(user);
    const value = await this.repository.updateRolePermissions(user.userId, user.tenantId, roleId, dto.permissionKeys, dto.reason);
    if (!value) throw new NotFoundException('Role not found');
    return value;
  }

  async createGrant(user: AuthenticatedUser, dto: CreateGrantDto) {
    this.assertPlatformAdmin(user);
    if (dto.userId === user.userId && dto.roleKey !== 'platform.super_admin') {
      throw new ConflictException('Do not downgrade your own break-glass access in the grant workflow');
    }
    const value = await this.repository.createGrant(user.userId, user.tenantId, dto);
    if (!value) throw new NotFoundException('Role not found');
    return value;
  }

  async revokeGrant(user: AuthenticatedUser, grantId: string, dto: RevokeGrantDto) {
    this.assertPlatformAdmin(user);
    const value = await this.repository.revokeGrant(user.userId, user.tenantId, grantId, dto.reason);
    if (!value) throw new NotFoundException('Active grant not found');
    return value;
  }

  async revokePrivilegedSession(user: AuthenticatedUser, sessionId: string, dto: RevokePrivilegedSessionDto) {
    this.assertPlatformAdmin(user);
    const value = await this.repository.revokePrivilegedSession(user.userId, user.tenantId, sessionId, dto.reason);
    if (!value) throw new NotFoundException('Active privileged session not found');
    return value;
  }

  async requestImpersonation(user: AuthenticatedUser, dto: ImpersonationRequestDto) {
    this.assertPlatformAdmin(user);
    if (dto.targetUserId === user.userId) throw new ConflictException('Cannot impersonate your own account');
    return this.repository.createImpersonationRequest(user.userId, user.tenantId, dto);
  }

  async decideImpersonation(user: AuthenticatedUser, requestId: string, dto: ImpersonationDecisionDto) {
    this.assertPlatformAdmin(user);
    const value = await this.repository.closeImpersonationRequest(user.userId, user.tenantId, requestId, dto.action, dto.reason);
    if (!value) throw new NotFoundException('Open impersonation request not found');
    return value;
  }

  async effectivePermissions(user: AuthenticatedUser, targetUserId?: string) {
    this.assertPlatformAdmin(user);
    const userId = targetUserId ?? user.userId;
    const permissions = await this.repository.effectivePermissions(userId);
    // Transitional bootstrap: existing platform_admin membership remains root until explicit grants are rolled out.
    if (userId === user.userId && user.role === 'platform_admin' && permissions.length === 0) {
      const all = await this.repository.permissions();
      return { userId, bootstrapRoot: true, permissions: all.map((p) => p.key) };
    }
    return { userId, bootstrapRoot: false, permissions };
  }
}

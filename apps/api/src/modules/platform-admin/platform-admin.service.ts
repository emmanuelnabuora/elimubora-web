import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import type {
  AcknowledgeAlertDto, DeleteTenantDto, DeleteUserDto, FeatureFlagDto, InstitutionStatusDto, ListQueryDto, SupportStatusDto
} from './platform-admin.dto';
import { PlatformAdminRepository } from './platform-admin.repository';

@Injectable()
export class PlatformAdminService {
  constructor(private readonly repository: PlatformAdminRepository) {}

  private assertPlatformAdmin(user: AuthenticatedUser): void {
    if (user.role !== 'platform_admin') throw new ForbiddenException('Platform administrator access required');
  }

  overview(user: AuthenticatedUser) { this.assertPlatformAdmin(user); return this.repository.overview(); }
  listInstitutions(user: AuthenticatedUser, query: ListQueryDto) { this.assertPlatformAdmin(user); return this.repository.listInstitutions(query); }
  async getInstitutionOverview(user: AuthenticatedUser, id: string) {
    this.assertPlatformAdmin(user);
    const value = await this.repository.getInstitutionOverview(id);
    if (!value) throw new NotFoundException('Institution not found');
    return value;
  }
  async updateInstitutionStatus(user: AuthenticatedUser, id: string, dto: InstitutionStatusDto) {
    this.assertPlatformAdmin(user);
    if (id === user.tenantId && dto.status !== 'active') throw new ForbiddenException('Cannot suspend the active platform tenant');
    const value = await this.repository.updateInstitutionStatus(user.userId, user.tenantId, id, dto.status, dto.reason);
    if (!value) throw new NotFoundException('Institution not found');
    return value;
  }
  listUsers(user: AuthenticatedUser, query: ListQueryDto) { this.assertPlatformAdmin(user); return this.repository.listUsers(query); }
  revokeSessions(user: AuthenticatedUser, id: string, reason: string) {
    this.assertPlatformAdmin(user);
    if (id === user.userId) throw new ForbiddenException('Use the account security page to revoke your own privileged session');
    return this.repository.revokeUserSessions(user.userId, user.tenantId, id, reason);
  }
  async deleteInstitution(user: AuthenticatedUser, id: string, dto: DeleteTenantDto) {
    this.assertPlatformAdmin(user);
    if (id === user.tenantId) throw new ForbiddenException('Cannot delete the platform tenant');
    const result = await this.repository.deleteInstitution(user.userId, user.tenantId, id, dto.confirmName, dto.reason);
    if (!result.ok && result.error === 'not_found') throw new NotFoundException('Institution not found');
    if (!result.ok && result.error === 'name_mismatch') throw new ForbiddenException('Confirmation name does not match this institution\u2019s name');
    return result;
  }
  async deleteUser(user: AuthenticatedUser, id: string, dto: DeleteUserDto) {
    this.assertPlatformAdmin(user);
    if (id === user.userId) throw new ForbiddenException('Cannot delete your own account');
    const value = await this.repository.deleteUser(user.userId, user.tenantId, id, dto.reason);
    if (!value) throw new NotFoundException('User not found');
    return value;
  }
  securityAlerts(user: AuthenticatedUser) { this.assertPlatformAdmin(user); return this.repository.securityAlerts(); }
  async acknowledgeAlert(user: AuthenticatedUser, id: string, dto: AcknowledgeAlertDto) {
    this.assertPlatformAdmin(user);
    const value = await this.repository.acknowledgeAlert(user.userId, user.tenantId, id, dto.note);
    if (!value) throw new NotFoundException('Security alert not found');
    return value;
  }
  supportTickets(user: AuthenticatedUser) { this.assertPlatformAdmin(user); return this.repository.supportTickets(); }
  async updateSupportTicket(user: AuthenticatedUser, id: string, dto: SupportStatusDto) {
    this.assertPlatformAdmin(user);
    const value = await this.repository.updateSupportTicket(user.userId, user.tenantId, id, dto.status, dto.note);
    if (!value) throw new NotFoundException('Support ticket not found');
    return value;
  }
  featureFlags(user: AuthenticatedUser) { this.assertPlatformAdmin(user); return this.repository.featureFlags(); }
  async updateFeatureFlag(user: AuthenticatedUser, key: string, dto: FeatureFlagDto) {
    this.assertPlatformAdmin(user);
    const value = await this.repository.updateFeatureFlag(user.userId, user.tenantId, key, dto.enabled, dto.rolloutPercentage, dto.reason);
    if (!value) throw new NotFoundException('Feature flag not found');
    return value;
  }
  operationsHealth(user: AuthenticatedUser) { this.assertPlatformAdmin(user); return this.repository.operationsHealth(); }
}

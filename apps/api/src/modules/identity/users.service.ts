import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import {
  NOTIFICATION_CHANNEL,
  type NotificationChannel
} from '../../core/notifications/notification';
import { IdentityRepository } from './identity.repository';
import type { MembershipRole } from './identity.types';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { UsersRepository, type InvitationRecord, type TenantUserRow } from './users.repository';

/**
 * User lifecycle. Notable rules:
 * - Invitations are the production onboarding path: raw tokens leave
 *   the system only through the notification channel (plus the API
 *   response outside production, for local development).
 * - An admin can never suspend, demote or remove their OWN membership:
 *   a school must not be able to lock itself out of its own data.
 * - Password reset responses are uniform (no account enumeration) and
 *   completing a reset revokes every active session for the user.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(NOTIFICATION_CHANNEL) private readonly notifications: NotificationChannel,
    private readonly users: UsersRepository,
    private readonly identity: IdentityRepository,
    private readonly passwords: PasswordService
  ) {}

  async createInvitation(input: {
    email: string;
    role: MembershipRole;
    invitedBy: string;
    studentId?: string;
    studentName?: string;
    relationship?: string;
    isPrimary?: boolean;
    canPickup?: boolean;
    isEmergencyContact?: boolean;
    permissions?: Record<string, boolean>;
  }): Promise<{ id: string; acceptUrl?: string }> {
    if (input.studentId && input.role !== 'parent') {
      throw new BadRequestException('Only a parent invitation can be linked to a student');
    }
    const token = randomBytes(32).toString('base64url');
    const id = await this.users.createInvitation({
      email: input.email.trim().toLowerCase(),
      role: input.role,
      invitedBy: input.invitedBy,
      tokenHash: TokenService.hashRefreshToken(token),
      ttlDays: this.config.auth.invitationTtlDays,
      studentId: input.studentId,
      relationship: input.relationship,
      isPrimary: input.isPrimary,
      canPickup: input.canPickup,
      isEmergencyContact: input.isEmergencyContact,
      permissions: input.permissions
    });
    const acceptUrl = `${this.config.publicWebUrl}/invitations/accept?token=${token}`;
    await this.notifications.deliver({
      to: { email: input.email },
      template: 'invitation',
      data: { acceptUrl, role: input.role, studentName: input.studentName }
    });
    return this.config.nodeEnv === 'production' ? { id } : { id, acceptUrl };
  }

  listInvitations(): Promise<InvitationRecord[]> {
    return this.users.listInvitations();
  }

  async revokeInvitation(id: string): Promise<void> {
    const ok = await this.users.revokeInvitation(id);
    if (!ok) throw new NotFoundException('Invitation not found or already resolved');
  }

  /** Regenerates a pending invitation's token, for a bounced email or an expired link — not guardian-specific, useful for any invitation kind. */
  async resendInvitation(id: string): Promise<{ id: string; acceptUrl?: string }> {
    const token = randomBytes(32).toString('base64url');
    const ok = await this.users.resendInvitation(id, TokenService.hashRefreshToken(token), this.config.auth.invitationTtlDays);
    if (!ok) throw new NotFoundException('Invitation not found, already resolved, or already expired');
    const acceptUrl = `${this.config.publicWebUrl}/invitations/accept?token=${token}`;
    return this.config.nodeEnv === 'production' ? { id } : { id, acceptUrl };
  }

  /** The invitee's own decline — no account needed, just a valid, still-pending token. */
  async declineInvitation(token: string): Promise<void> {
    const invitation = await this.users.findInvitationByTokenHash(TokenService.hashRefreshToken(token));
    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException('Invitation is invalid or has expired');
    }
    await this.users.declineInvitation(invitation.tenantId, invitation.id);
  }

  /** Just enough context to show before someone commits to accepting — which role, and which child if this is a guardian invite. Same validation as accept's own lookup, but read-only. */
  async previewInvitation(token: string): Promise<{ role: MembershipRole; studentId: string | null; tenantId: string }> {
    const invitation = await this.users.findInvitationByTokenHash(TokenService.hashRefreshToken(token));
    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException('Invitation is invalid or has expired');
    }
    return { role: invitation.role, studentId: invitation.studentId, tenantId: invitation.tenantId };
  }

  async acceptInvitation(input: {
    token: string;
    fullName?: string;
    password?: string;
  }): Promise<{
    userId: string;
    createdUser: boolean;
    tenantId: string;
    email: string;
    fullName: string;
    studentId: string | null;
    relationship: string | null;
    isPrimary: boolean | null;
    canPickup: boolean | null;
    isEmergencyContact: boolean | null;
    permissions: Record<string, boolean> | null;
  }> {
    const invitation = await this.users.findInvitationByTokenHash(
      TokenService.hashRefreshToken(input.token)
    );
    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException('Invitation is invalid or has expired');
    }

    const existing = await this.identity.findUserByEmail(invitation.email);
    if (!existing && (!input.fullName || !input.password)) {
      throw new BadRequestException('fullName and password are required for a new account');
    }

    try {
      const result = await this.users.acceptInvitation({
        invitationId: invitation.id,
        tenantId: invitation.tenantId,
        email: invitation.email,
        role: invitation.role,
        existingUserId: existing?.id ?? null,
        fullName: input.fullName,
        passwordHash: input.password ? await this.passwords.hash(input.password) : undefined
      });
      return {
        ...result,
        tenantId: invitation.tenantId,
        email: invitation.email,
        fullName: existing?.fullName ?? input.fullName ?? '',
        studentId: invitation.studentId,
        relationship: invitation.relationship,
        isPrimary: invitation.isPrimary,
        canPickup: invitation.canPickup,
        isEmergencyContact: invitation.isEmergencyContact,
        permissions: invitation.permissions
      };
    } catch (err) {
      if (err instanceof Error && err.message === 'INVITATION_NO_LONGER_VALID') {
        throw new ConflictException('Invitation was already used');
      }
      throw err;
    }
  }

  listTenantUsers(limit: number, offset: number): Promise<TenantUserRow[]> {
    return this.users.listTenantUsers(limit, offset);
  }

  async updateMembership(
    actorUserId: string,
    targetUserId: string,
    patch: { role?: MembershipRole; status?: 'active' | 'suspended' }
  ): Promise<void> {
    if (actorUserId === targetUserId) {
      throw new ForbiddenException('You cannot modify your own membership');
    }
    const ok = await this.users.updateMembership(targetUserId, patch);
    if (!ok) throw new NotFoundException('No active membership for that user');
    if (patch.status === 'suspended') {
      await this.identity.revokeAllForUser(targetUserId);
    }
  }

  /**
   * Updates a user's display name. Unlike updateMembership, editing
   * your own name is fine — nothing here can be used to escalate
   * privilege the way changing your own role could, so there's no
   * self-edit block.
   */
  async updateFullName(targetUserId: string, fullName: string): Promise<void> {
    const ok = await this.users.updateFullName(targetUserId, fullName);
    if (!ok) throw new NotFoundException('No active membership for that user');
  }

  async removeMembership(actorUserId: string, targetUserId: string): Promise<void> {
    if (actorUserId === targetUserId) {
      throw new ForbiddenException('You cannot remove your own membership');
    }
    const ok = await this.users.softDeleteMembership(targetUserId);
    if (!ok) throw new NotFoundException('No active membership for that user');
    await this.identity.revokeAllForUser(targetUserId);
  }

  // ---------------- password reset ----------------

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.identity.findUserByEmail(email.trim().toLowerCase());
    if (!user) {
      // Uniform outcome — do not reveal whether the account exists.
      this.logger.log('Password reset requested for unknown email');
      return;
    }
    const token = randomBytes(32).toString('base64url');
    await this.users.createPasswordReset({
      userId: user.id,
      tokenHash: TokenService.hashRefreshToken(token),
      ttlMinutes: this.config.auth.passwordResetTtlMinutes
    });
    await this.notifications.deliver({
      to: { email: user.email },
      template: 'password-reset',
      data: { resetUrl: `${this.config.publicWebUrl}/password/reset?token=${token}` }
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const userId = await this.users.consumePasswordReset(TokenService.hashRefreshToken(token));
    if (!userId) {
      throw new BadRequestException('Reset link is invalid or has expired');
    }
    await this.identity.setPassword(userId, await this.passwords.hash(newPassword));
    await this.identity.revokeAllForUser(userId);
    this.logger.log(`Password reset completed for user ${userId}; all sessions revoked`);
  }
}

import { Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser, Public, Roles } from '../core/auth/decorators';
import type { AuthenticatedUser } from '../core/auth/auth.types';
import { ZodValidationPipe } from '../core/http/zod-validation.pipe';
import { UsersService } from '../modules/identity/users.service';
import { SisRepository } from '../modules/sis/sis.repository';
import { acceptInvitationSchema, type AcceptInvitationDto } from '../modules/identity/users.dto';
import {
  createGuardianInvitationSchema,
  declineInvitationSchema,
  type CreateGuardianInvitationDto,
  type DeclineInvitationDto
} from './guardian-invitations.dto';

const ADMIN_ROLES = new Set(['school_admin', 'principal']);

/**
 * A real gap this closes: PATCH /guardians/:id/link-account only
 * ever worked for a parent who already had a portal account -- there
 * was no way to invite someone new and have that invitation itself
 * establish the guardian link. Lives in composition because
 * completing it genuinely needs both identity (create the account)
 * and sis (create the guardian link) together, which neither module
 * can do reaching into the other directly -- the same reason
 * AnnouncementsReadController lives here.
 *
 * Resending a pending invitation reuses the existing, generic
 * PATCH /invitations/:id/resend on the identity module directly --
 * it isn't guardian-specific, so it doesn't need a second endpoint
 * here.
 */
@Controller()
export class GuardianInvitationsController {
  constructor(
    private readonly users: UsersService,
    private readonly sis: SisRepository
  ) {}

  @Post('students/:studentId/guardian-invitations')
  @Roles('school_admin', 'principal')
  async invite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body(new ZodValidationPipe(createGuardianInvitationSchema)) dto: CreateGuardianInvitationDto
  ) {
    if (!ADMIN_ROLES.has(user.role)) {
      throw new ForbiddenException('Only school administration can invite a guardian');
    }
    // Confirms the student genuinely belongs to the caller's own
    // school before anything else -- findStudentProfile already
    // filters by tenant_id = current_tenant_id() and returns null
    // otherwise, which is exactly the check needed here: an admin at
    // one school must never be able to send a guardian invitation
    // (with a real, working account-creation link) for a student at
    // a different one.
    const profile = await this.sis.findStudentProfile(studentId);
    if (!profile) throw new ForbiddenException('Student not found at your school');

    const studentName = await this.sis.getStudentName(studentId);
    return this.users.createInvitation({
      email: dto.email,
      role: 'parent',
      invitedBy: user.userId,
      studentId,
      studentName: studentName ?? undefined,
      relationship: dto.relationship,
      isPrimary: dto.isPrimary,
      canPickup: dto.canPickup,
      isEmergencyContact: dto.isEmergencyContact,
      permissions: dto.permissions
    });
  }

  @Public()
  @Post('guardian-invitations/accept')
  async accept(@Body(new ZodValidationPipe(acceptInvitationSchema)) dto: AcceptInvitationDto) {
    const result = await this.users.acceptInvitation(dto);
    if (result.studentId) {
      await this.sis.linkGuardianFromInvitation({
        tenantId: result.tenantId,
        userId: result.userId,
        studentId: result.studentId,
        fullName: result.fullName,
        email: result.email,
        relationship: result.relationship ?? 'guardian',
        isPrimary: result.isPrimary ?? false,
        canPickup: result.canPickup ?? true,
        isEmergencyContact: result.isEmergencyContact ?? false,
        permissions: result.permissions
      });
    }
    return result;
  }

  @Public()
  @Get('guardian-invitations/preview/:token')
  async preview(@Param('token') token: string) {
    const result = await this.users.previewInvitation(token);
    const studentName = result.studentId
      ? await this.sis.getStudentNameWithContext(result.tenantId, result.studentId)
      : null;
    return { role: result.role, studentName };
  }

  @Public()
  @Post('guardian-invitations/decline')
  async decline(@Body(new ZodValidationPipe(declineInvitationSchema)) dto: DeclineInvitationDto) {
    await this.users.declineInvitation(dto.token);
    return { status: 'declined' };
  }
}

import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentUser, Public, Roles } from '../core/auth/decorators';
import type { AuthenticatedUser } from '../core/auth/auth.types';
import { ZodValidationPipe } from '../core/http/zod-validation.pipe';
import {
  approveSchoolApplicationSchema,
  checkSchoolApplicationStatusSchema,
  listSchoolApplicationsQuerySchema,
  rejectSchoolApplicationSchema,
  submitSchoolApplicationSchema,
  type ApproveSchoolApplicationDto,
  type CheckSchoolApplicationStatusDto,
  type ListSchoolApplicationsQueryDto,
  type RejectSchoolApplicationDto,
  type SubmitSchoolApplicationDto
} from './school-applications.dto';
import { SchoolApplicationsService } from './school-applications.service';

/**
 * Self-serve school onboarding, gated by platform_admin review. The
 * public routes (submit, status) need no auth at all — an applicant
 * has no account yet, by design. The review routes reuse the same
 * platform_admin-only pattern as TenantProvisioningController.
 */
@Controller()
export class SchoolApplicationsController {
  constructor(private readonly service: SchoolApplicationsService) {}

  @Public()
  @Post('school-applications')
  submit(@Body(new ZodValidationPipe(submitSchoolApplicationSchema)) dto: SubmitSchoolApplicationDto) {
    return this.service.submit(dto);
  }

  @Public()
  @Post('school-applications/status')
  checkStatus(
    @Body(new ZodValidationPipe(checkSchoolApplicationStatusSchema)) dto: CheckSchoolApplicationStatusDto
  ) {
    return this.service.checkStatus(dto.token);
  }

  @Get('admin/school-applications')
  @Roles('platform_admin')
  list(@Query(new ZodValidationPipe(listSchoolApplicationsQuerySchema)) query: ListSchoolApplicationsQueryDto) {
    return this.service.list(query.status);
  }

  @Get('admin/school-applications/:id')
  @Roles('platform_admin')
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getById(id);
  }

  @Post('admin/school-applications/:id/approve')
  @Roles('platform_admin')
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(approveSchoolApplicationSchema)) dto: ApproveSchoolApplicationDto
  ) {
    return this.service.approve(user, id, dto);
  }

  @Post('admin/school-applications/:id/reject')
  @Roles('platform_admin')
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(rejectSchoolApplicationSchema)) dto: RejectSchoolApplicationDto
  ) {
    return this.service.reject(user, id, dto);
  }

  @Post('admin/school-applications/:id/resend-invitation')
  @Roles('platform_admin')
  resendInvitation(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.resendInvitation(user, id);
  }
}

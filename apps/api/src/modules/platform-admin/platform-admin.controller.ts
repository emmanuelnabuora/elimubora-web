import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, Roles } from '../../core/auth/decorators';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { ZodValidationPipe } from '../../core/http/zod-validation.pipe';
import {
  acknowledgeAlertSchema, deleteTenantSchema, deleteUserSchema, featureFlagSchema, institutionStatusSchema, listQuerySchema, supportStatusSchema,
  type AcknowledgeAlertDto, type DeleteTenantDto, type DeleteUserDto, type FeatureFlagDto, type InstitutionStatusDto, type ListQueryDto, type SupportStatusDto
} from './platform-admin.dto';
import { PlatformAdminService } from './platform-admin.service';

@Controller('platform-admin')
@Roles('platform_admin')
export class PlatformAdminController {
  constructor(private readonly service: PlatformAdminService) {}

  @Get('overview') overview(@CurrentUser() user: AuthenticatedUser) { return this.service.overview(user); }
  @Get('institutions') institutions(@CurrentUser() user: AuthenticatedUser, @Query(new ZodValidationPipe(listQuerySchema)) query: ListQueryDto) { return this.service.listInstitutions(user, query); }
  @Get('institutions/:id') institutionOverview(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.service.getInstitutionOverview(user, id); }
  @Patch('institutions/:id/status') institutionStatus(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body(new ZodValidationPipe(institutionStatusSchema)) dto: InstitutionStatusDto) { return this.service.updateInstitutionStatus(user, id, dto); }
  @Post('institutions/:id/delete') deleteInstitution(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body(new ZodValidationPipe(deleteTenantSchema)) dto: DeleteTenantDto) { return this.service.deleteInstitution(user, id, dto); }
  @Get('users') users(@CurrentUser() user: AuthenticatedUser, @Query(new ZodValidationPipe(listQuerySchema)) query: ListQueryDto) { return this.service.listUsers(user, query); }
  @Post('users/:id/revoke-sessions') revokeSessions(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: { reason?: string }) { return this.service.revokeSessions(user, id, body.reason?.trim() || 'Privileged administrator action'); }
  @Post('users/:id/delete') deleteUser(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body(new ZodValidationPipe(deleteUserSchema)) dto: DeleteUserDto) { return this.service.deleteUser(user, id, dto); }
  @Get('security/alerts') securityAlerts(@CurrentUser() user: AuthenticatedUser) { return this.service.securityAlerts(user); }
  @Patch('security/alerts/:id/acknowledge') acknowledgeAlert(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body(new ZodValidationPipe(acknowledgeAlertSchema)) dto: AcknowledgeAlertDto) { return this.service.acknowledgeAlert(user, id, dto); }
  @Get('support/tickets') supportTickets(@CurrentUser() user: AuthenticatedUser) { return this.service.supportTickets(user); }
  @Patch('support/tickets/:id/status') supportStatus(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body(new ZodValidationPipe(supportStatusSchema)) dto: SupportStatusDto) { return this.service.updateSupportTicket(user, id, dto); }
  @Get('feature-flags') featureFlags(@CurrentUser() user: AuthenticatedUser) { return this.service.featureFlags(user); }
  @Patch('feature-flags/:key') featureFlag(@CurrentUser() user: AuthenticatedUser, @Param('key') key: string, @Body(new ZodValidationPipe(featureFlagSchema)) dto: FeatureFlagDto) { return this.service.updateFeatureFlag(user, key, dto); }
  @Get('operations/health') operationsHealth(@CurrentUser() user: AuthenticatedUser) { return this.service.operationsHealth(user); }
}

import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, Roles } from '../../core/auth/decorators';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { ZodValidationPipe } from '../../core/http/zod-validation.pipe';
import {
  createGrantSchema, createRoleSchema, impersonationDecisionSchema, impersonationRequestSchema,
  revokeGrantSchema, revokePrivilegedSessionSchema, updateRolePermissionsSchema,
  type CreateGrantDto, type CreateRoleDto, type ImpersonationDecisionDto, type ImpersonationRequestDto,
  type RevokeGrantDto, type RevokePrivilegedSessionDto, type UpdateRolePermissionsDto
} from './platform-access.dto';
import { PlatformAccessService } from './platform-access.service';

@Controller('platform-admin/access')
@Roles('platform_admin')
export class PlatformAccessController {
  constructor(private readonly service: PlatformAccessService) {}

  @Get('permissions') permissions(@CurrentUser() user: AuthenticatedUser) { return this.service.permissions(user); }
  @Get('roles') roles(@CurrentUser() user: AuthenticatedUser) { return this.service.roles(user); }
  @Post('roles') createRole(@CurrentUser() user: AuthenticatedUser, @Body(new ZodValidationPipe(createRoleSchema)) dto: CreateRoleDto) { return this.service.createRole(user, dto); }
  @Patch('roles/:id/permissions') rolePermissions(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body(new ZodValidationPipe(updateRolePermissionsSchema)) dto: UpdateRolePermissionsDto) { return this.service.updateRolePermissions(user, id, dto); }

  @Get('grants') grants(@CurrentUser() user: AuthenticatedUser) { return this.service.grants(user); }
  @Post('grants') createGrant(@CurrentUser() user: AuthenticatedUser, @Body(new ZodValidationPipe(createGrantSchema)) dto: CreateGrantDto) { return this.service.createGrant(user, dto); }
  @Patch('grants/:id/revoke') revokeGrant(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body(new ZodValidationPipe(revokeGrantSchema)) dto: RevokeGrantDto) { return this.service.revokeGrant(user, id, dto); }

  @Get('privileged-sessions') privilegedSessions(@CurrentUser() user: AuthenticatedUser) { return this.service.privilegedSessions(user); }
  @Patch('privileged-sessions/:id/revoke') revokePrivilegedSession(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body(new ZodValidationPipe(revokePrivilegedSessionSchema)) dto: RevokePrivilegedSessionDto) { return this.service.revokePrivilegedSession(user, id, dto); }

  @Get('impersonation') impersonation(@CurrentUser() user: AuthenticatedUser) { return this.service.impersonationRequests(user); }
  @Post('impersonation') requestImpersonation(@CurrentUser() user: AuthenticatedUser, @Body(new ZodValidationPipe(impersonationRequestSchema)) dto: ImpersonationRequestDto) { return this.service.requestImpersonation(user, dto); }
  @Patch('impersonation/:id') decideImpersonation(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body(new ZodValidationPipe(impersonationDecisionSchema)) dto: ImpersonationDecisionDto) { return this.service.decideImpersonation(user, id, dto); }

  @Get('effective-permissions') effectivePermissions(@CurrentUser() user: AuthenticatedUser, @Query('userId') userId?: string) { return this.service.effectivePermissions(user, userId); }
}

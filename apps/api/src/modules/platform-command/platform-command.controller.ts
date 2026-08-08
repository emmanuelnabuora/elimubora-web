import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, Roles } from '../../core/auth/decorators';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { ZodValidationPipe } from '../../core/http/zod-validation.pipe';
import {
  createComplianceRequestSchema,
  createIncidentSchema,
  requestRestoreSchema,
  updateIncidentSchema,
  type CreateComplianceRequestDto,
  type CreateIncidentDto,
  type RequestRestoreDto,
  type UpdateIncidentDto
} from './platform-command.dto';
import { PlatformCommandService } from './platform-command.service';

@Controller('platform-admin/command')
@Roles('platform_admin')
export class PlatformCommandController {
  constructor(private readonly service: PlatformCommandService) {}

  @Get('infrastructure/health')
  health() {
    return this.service.serviceHealth();
  }

  @Get('incidents')
  incidents() {
    return this.service.incidents();
  }

  @Post('incidents')
  createIncident(@CurrentUser() user: AuthenticatedUser, @Body(new ZodValidationPipe(createIncidentSchema)) dto: CreateIncidentDto) {
    return this.service.createIncident(user, dto);
  }

  @Patch('incidents/:id')
  updateIncident(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateIncidentSchema)) dto: UpdateIncidentDto
  ) {
    return this.service.updateIncident(user, id, dto);
  }

  @Get('compliance/requests')
  compliance() {
    return this.service.complianceRequests();
  }

  @Post('compliance/requests')
  createCompliance(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createComplianceRequestSchema)) dto: CreateComplianceRequestDto
  ) {
    return this.service.createComplianceRequest(user, dto);
  }

  @Get('recovery/backups')
  backups() {
    return this.service.backups();
  }

  @Get('recovery/restores')
  restores() {
    return this.service.restoreRequests();
  }

  @Post('recovery/restores')
  requestRestore(@CurrentUser() user: AuthenticatedUser, @Body(new ZodValidationPipe(requestRestoreSchema)) dto: RequestRestoreDto) {
    return this.service.requestRestore(user, dto);
  }

  @Patch('recovery/restores/:id/approve')
  approveRestore(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.approveRestore(user, id);
  }

  @Get('deployments')
  deployments() {
    return this.service.deployments();
  }

  @Get('readiness')
  readiness() {
    return this.service.readiness();
  }
}

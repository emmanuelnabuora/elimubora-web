import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ZodValidationPipe } from '../http/zod-validation.pipe';
import {
  createTenantSchema,
  updateTenantLogoSchema,
  type CreateTenantDto,
  type UpdateTenantLogoDto
} from './tenant-provisioning.dto';
import { TenantProvisioningService } from './tenant-provisioning.service';

@Controller('tenants')
@Roles('platform_admin')
export class TenantProvisioningController {
  constructor(private readonly service: TenantProvisioningService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createTenantSchema)) dto: CreateTenantDto
  ) {
    return this.service.createSchoolTenant(user, dto);
  }

  @Get('current')
  @Roles('learner', 'teacher', 'parent', 'school_admin', 'principal', 'county_officer', 'ministry_official', 'platform_admin')
  getCurrent(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getCurrentTenant(user);
  }

  @Get('schools')
  @Roles('school_admin', 'principal', 'platform_admin')
  listSchools(@CurrentUser() user: AuthenticatedUser, @Query('search') search?: string) {
    return this.service.listSchools(user, search);
  }

  @Patch('logo')
  @Roles('school_admin', 'principal', 'platform_admin')
  updateLogo(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateTenantLogoSchema)) dto: UpdateTenantLogoDto
  ) {
    return this.service.updateTenantLogo(user, dto);
  }
}

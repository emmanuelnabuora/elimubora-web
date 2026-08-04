import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ZodValidationPipe } from '../http/zod-validation.pipe';
import { createTenantSchema, type CreateTenantDto } from './tenant-provisioning.dto';
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
}

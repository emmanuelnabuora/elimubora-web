import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, Roles } from '../../core/auth/decorators';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { ZodValidationPipe } from '../../core/http/zod-validation.pipe';
import { createBroadcastSchema, type CreateBroadcastDto } from './platform-business.dto';
import { PlatformBusinessService } from './platform-business.service';

@Controller('platform-admin/business')
@Roles('platform_admin')
export class PlatformBusinessController {
  constructor(private readonly service: PlatformBusinessService) {}

  @Get('plans')
  plans() {
    return this.service.plans();
  }

  @Get('subscriptions')
  subscriptions() {
    return this.service.subscriptions();
  }

  @Get('invoices')
  invoices() {
    return this.service.invoices();
  }

  @Get('payments')
  payments() {
    return this.service.payments();
  }

  @Get('integrations')
  integrations() {
    return this.service.integrations();
  }

  @Get('broadcasts')
  broadcasts() {
    return this.service.broadcasts();
  }

  @Post('broadcasts')
  create(@CurrentUser() user: AuthenticatedUser, @Body(new ZodValidationPipe(createBroadcastSchema)) dto: CreateBroadcastDto) {
    return this.service.createBroadcast(user, dto);
  }

  @Patch('broadcasts/:id/approve')
  approve(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.approveBroadcast(user, id);
  }

  @Post('broadcasts/:id/publish')
  publish(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.publishBroadcast(user, id);
  }
}

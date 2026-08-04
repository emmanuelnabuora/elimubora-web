import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators';
import { AuditService } from './audit.service';

@Controller('audit-log')
@Roles('school_admin', 'principal', 'platform_admin')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query('limit') limit?: string) {
    const parsed = limit ? Number.parseInt(limit, 10) : undefined;
    return this.audit.listRecent(parsed && Number.isFinite(parsed) ? parsed : undefined);
  }
}

import { Module } from '@nestjs/common';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminRepository } from './platform-admin.repository';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformAccessController } from './platform-access.controller';
import { PlatformAccessRepository } from './platform-access.repository';
import { PlatformAccessService } from './platform-access.service';

@Module({
  controllers: [PlatformAdminController, PlatformAccessController],
  providers: [PlatformAdminRepository, PlatformAdminService, PlatformAccessRepository, PlatformAccessService]
})
export class PlatformAdminModule {}

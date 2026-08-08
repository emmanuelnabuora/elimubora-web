import { Module } from '@nestjs/common';
import { PlatformBusinessController } from './platform-business.controller';
import { PlatformBusinessService } from './platform-business.service';
import { PlatformBusinessRepository } from './platform-business.repository';
@Module({controllers:[PlatformBusinessController],providers:[PlatformBusinessService,PlatformBusinessRepository],exports:[PlatformBusinessService]})
export class PlatformBusinessModule {}

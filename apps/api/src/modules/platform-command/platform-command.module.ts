import { Module } from '@nestjs/common';
import { PlatformCommandController } from './platform-command.controller';
import { PlatformCommandService } from './platform-command.service';
import { PlatformCommandRepository } from './platform-command.repository';

@Module({
  controllers: [PlatformCommandController],
  providers: [PlatformCommandService, PlatformCommandRepository],
  exports: [PlatformCommandService],
})
export class PlatformCommandModule {}

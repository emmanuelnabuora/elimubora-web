import { Module } from '@nestjs/common';
import { PlatformIntelligenceController } from './platform-intelligence.controller';
import { PlatformIntelligenceService } from './platform-intelligence.service';
import { PlatformIntelligenceRepository } from './platform-intelligence.repository';

@Module({
  controllers: [PlatformIntelligenceController],
  providers: [PlatformIntelligenceService, PlatformIntelligenceRepository],
  exports: [PlatformIntelligenceService],
})
export class PlatformIntelligenceModule {}

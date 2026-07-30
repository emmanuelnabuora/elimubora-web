import { Module } from '@nestjs/common';
import { AnnouncementsController } from './comms.controller';
import { CommsRepository } from './comms.repository';
import { CommsService } from './comms.service';

/**
 * Communication primitives (Module 12 preview — Sprint 7 scope adds
 * only announcements, needed by Parent Portal). Full messaging
 * (parent-teacher conversations, SMS/WhatsApp fan-out) is Sprint 12.
 */
@Module({
  controllers: [AnnouncementsController],
  providers: [CommsRepository, CommsService],
  exports: [CommsRepository]
})
export class CommsModule {}

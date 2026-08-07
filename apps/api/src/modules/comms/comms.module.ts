import { Module } from '@nestjs/common';
import { AnnouncementsController, ConversationsController } from './comms.controller';
import { CommsRepository } from './comms.repository';
import { CommsService } from './comms.service';

/**
 * Communication primitives: one-way broadcast announcements, plus
 * two-way direct messaging between a staff member and a student.
 * SMS/WhatsApp fan-out remains future scope.
 */
@Module({
  controllers: [AnnouncementsController, ConversationsController],
  providers: [CommsRepository, CommsService],
  exports: [CommsRepository]
})
export class CommsModule {}

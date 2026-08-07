import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser } from '../../core/auth/decorators';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { ZodValidationPipe } from '../../core/http/zod-validation.pipe';
import {
  createAnnouncementSchema,
  sendMessageSchema,
  startConversationSchema,
  type CreateAnnouncementDto,
  type SendMessageDto,
  type StartConversationDto
} from './comms.dto';
import { CommsService } from './comms.service';

@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly service: CommsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createAnnouncementSchema)) dto: CreateAnnouncementDto
  ) {
    return this.service.create(user, dto);
  }
}

/** Direct messaging between a staff member (teacher/admin) and a student — two-way, distinct from the one-way broadcast AnnouncementsController above. */
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly service: CommsService) {}

  @Post()
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(startConversationSchema)) dto: StartConversationDto
  ) {
    return this.service.startConversation(user, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listMyConversations(user);
  }

  @Get(':id/messages')
  messages(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.getMessages(user, id);
  }

  @Post(':id/messages')
  reply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(sendMessageSchema)) dto: SendMessageDto
  ) {
    return this.service.reply(user, id, dto);
  }
}

import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../../core/auth/decorators';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { ZodValidationPipe } from '../../core/http/zod-validation.pipe';
import { createAnnouncementSchema, type CreateAnnouncementDto } from './comms.dto';
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

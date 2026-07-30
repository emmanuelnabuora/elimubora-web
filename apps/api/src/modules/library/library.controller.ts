import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../core/auth/decorators';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { ZodValidationPipe } from '../../core/http/zod-validation.pipe';
import {
  createResourceSchema,
  listResourcesQuerySchema,
  logAccessSchema,
  type CreateResourceDto,
  type ListResourcesQueryDto,
  type LogAccessDto
} from './library.dto';
import { LibraryService } from './library.service';

@Controller('library/resources')
export class LibraryController {
  constructor(private readonly service: LibraryService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createResourceSchema)) dto: CreateResourceDto
  ) {
    return this.service.createResource(user, dto);
  }

  @Get()
  list(@Query(new ZodValidationPipe(listResourcesQuerySchema)) query: ListResourcesQueryDto) {
    return this.service.listResources(query);
  }

  @Get('recent')
  recent(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listRecentForUser(user);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getResource(id);
  }

  @Post(':id/access')
  recordAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(logAccessSchema)) dto: LogAccessDto
  ) {
    return this.service.recordAccess(user, id, dto.action);
  }
}

import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../core/auth/decorators';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { ZodValidationPipe } from '../../core/http/zod-validation.pipe';
import {
  createLessonPlanSchema,
  draftLessonPlanWithAiSchema,
  markAttendanceSchema,
  updateLessonPlanStatusSchema,
  type CreateLessonPlanDto,
  type DraftLessonPlanWithAiDto,
  type MarkAttendanceDto,
  type UpdateLessonPlanStatusDto
} from './teacher-portal.dto';
import { TeacherPortalService } from './teacher-portal.service';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly service: TeacherPortalService) {}

  /** Synchronous marking path — offline clients use POST /sync/push instead. */
  @Post()
  mark(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(markAttendanceSchema)) dto: MarkAttendanceDto
  ) {
    return this.service.markAttendance(user, dto);
  }

  @Get('class/:classStreamId')
  listForClass(
    @Param('classStreamId', ParseUUIDPipe) classStreamId: string,
    @Query('date') date: string
  ) {
    return this.service.listAttendanceForClass(classStreamId, date);
  }

  @Get('learner/:learnerId')
  listForLearner(@Param('learnerId', ParseUUIDPipe) learnerId: string) {
    return this.service.listAttendanceForLearner(learnerId);
  }
}

@Controller('lesson-plans')
export class LessonPlansController {
  constructor(private readonly service: TeacherPortalService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createLessonPlanSchema)) dto: CreateLessonPlanDto
  ) {
    return this.service.createLessonPlan(user, dto);
  }

  @Post('ai-draft')
  draftWithAi(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(draftLessonPlanWithAiSchema)) dto: DraftLessonPlanWithAiDto
  ) {
    return this.service.draftLessonPlanWithAi(user, dto);
  }

  @Get('course/:courseId')
  listForCourse(@Param('courseId', ParseUUIDPipe) courseId: string) {
    return this.service.listLessonPlans(courseId);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateLessonPlanStatusSchema)) dto: UpdateLessonPlanStatusDto
  ) {
    return this.service.updateLessonPlanStatus(user, id, dto.status);
  }
}

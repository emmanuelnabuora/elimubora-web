import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query
} from '@nestjs/common';
import { CurrentUser } from '../../core/auth/decorators';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { ZodValidationPipe } from '../../core/http/zod-validation.pipe';
import {
  createAssignmentSchema,
  createCourseSchema,
  createLessonSchema,
  createModuleSchema,
  createSubmissionSchema,
  enrollSchema,
  gradeSubmissionSchema,
  updateCourseSchema,
  type CreateAssignmentDto,
  type CreateCourseDto,
  type CreateLessonDto,
  type CreateModuleDto,
  type CreateSubmissionDto,
  type EnrollDto,
  type GradeSubmissionDto,
  type UpdateCourseDto
} from './learning.dto';
import { LearningService } from './learning.service';

@Controller('courses')
export class CoursesController {
  constructor(private readonly learning: LearningService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createCourseSchema)) dto: CreateCourseDto
  ) {
    return this.learning.createCourse(user, dto);
  }

  @Get()
  list(@Query('gradeLevel') gradeLevel?: string, @Query('status') status?: string) {
    return this.learning.listCourses({ gradeLevel, status });
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.learning.getCourse(id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateCourseSchema)) dto: UpdateCourseDto
  ) {
    return this.learning.updateCourse(user, id, dto);
  }

  @Post(':id/modules')
  createModule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) courseId: string,
    @Body(new ZodValidationPipe(createModuleSchema)) dto: CreateModuleDto
  ) {
    return this.learning.createModule(user, courseId, dto);
  }

  @Get(':id/modules')
  listModules(@Param('id', ParseUUIDPipe) courseId: string) {
    return this.learning.listModules(courseId);
  }

  @Post(':id/modules/:moduleId/lessons')
  createLesson(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) courseId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Body(new ZodValidationPipe(createLessonSchema)) dto: CreateLessonDto
  ) {
    return this.learning.createLesson(user, courseId, moduleId, dto);
  }

  @Get(':id/modules/:moduleId/lessons')
  listLessons(@Param('moduleId', ParseUUIDPipe) moduleId: string) {
    return this.learning.listLessons(moduleId);
  }

  @Post(':id/assignments')
  createAssignment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) courseId: string,
    @Body(new ZodValidationPipe(createAssignmentSchema)) dto: CreateAssignmentDto
  ) {
    return this.learning.createAssignment(user, courseId, dto);
  }

  @Get(':id/assignments')
  listAssignments(@Param('id', ParseUUIDPipe) courseId: string) {
    return this.learning.listAssignments(courseId);
  }

  @Post(':id/enrollments')
  enroll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) courseId: string,
    @Body(new ZodValidationPipe(enrollSchema)) dto: EnrollDto
  ) {
    return this.learning.enroll(user, courseId, dto);
  }

  @Get(':id/roster')
  roster(@Param('id', ParseUUIDPipe) courseId: string) {
    return this.learning.listRoster(courseId);
  }
}

@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly learning: LearningService) {}

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.learning.getAssignment(id);
  }

  /** Synchronous submission path — offline clients use POST /sync/push instead. */
  @Post(':id/submissions')
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) assignmentId: string,
    @Body(new ZodValidationPipe(createSubmissionSchema)) dto: CreateSubmissionDto
  ) {
    return this.learning.submit(user, assignmentId, dto);
  }

  @Get(':id/submissions')
  listSubmissions(@Param('id', ParseUUIDPipe) assignmentId: string) {
    return this.learning.listSubmissions(assignmentId);
  }

  @Get(':id/submissions/me')
  mySubmission(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) assignmentId: string
  ) {
    return this.learning.getSubmission(assignmentId, user.userId);
  }
}

@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly learning: LearningService) {}

  @Patch(':id/grade')
  grade(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(gradeSubmissionSchema)) dto: GradeSubmissionDto
  ) {
    return this.learning.grade(user, id, dto);
  }
}

import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../core/auth/decorators';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { ZodValidationPipe } from '../../core/http/zod-validation.pipe';
import {
  refreshSnapshotSchema,
  snapshotQuerySchema,
  type RefreshSnapshotDto,
  type SnapshotQueryDto
} from './government.dto';
import { GovernmentService } from './government.service';

@Controller('gov')
export class GovernmentController {
  constructor(private readonly service: GovernmentService) {}

  @Post('enrollment/refresh')
  refreshEnrollment(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(refreshSnapshotSchema)) dto: RefreshSnapshotDto
  ) {
    return this.service.refreshEnrollment(user, dto.academicYear);
  }

  @Post('attendance/refresh')
  refreshAttendance(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(refreshSnapshotSchema)) dto: RefreshSnapshotDto
  ) {
    return this.service.refreshAttendance(user, dto.academicYear);
  }

  @Get('enrollment')
  getEnrollment(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(snapshotQuerySchema)) query: SnapshotQueryDto
  ) {
    return this.service.getEnrollment(user, query.academicYear, query.countyCode);
  }

  @Get('enrollment/by-county')
  listEnrollmentByCounty(
    @CurrentUser() user: AuthenticatedUser,
    @Query('academicYear') academicYear: string
  ) {
    return this.service.listEnrollmentByCounty(user, Number(academicYear));
  }

  @Get('attendance')
  getAttendance(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(snapshotQuerySchema)) query: SnapshotQueryDto
  ) {
    return this.service.getAttendance(user, query.academicYear, query.countyCode);
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query
} from '@nestjs/common';
import { CurrentUser } from '../../core/auth/decorators';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { ZodValidationPipe } from '../../core/http/zod-validation.pipe';
import {
  createLeaveRequestSchema,
  createRoomSchema,
  createTimetableSlotSchema,
  decideLeaveRequestSchema,
  type CreateLeaveRequestDto,
  type CreateRoomDto,
  type CreateTimetableSlotDto,
  type DecideLeaveRequestDto
} from './school-admin.dto';
import { SchoolAdminService } from './school-admin.service';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly service: SchoolAdminService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createRoomSchema)) dto: CreateRoomDto
  ) {
    return this.service.createRoom(user, dto);
  }

  @Get()
  list() {
    return this.service.listRooms();
  }
}

@Controller('timetable')
export class TimetableController {
  constructor(private readonly service: SchoolAdminService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createTimetableSlotSchema)) dto: CreateTimetableSlotDto
  ) {
    return this.service.createTimetableSlot(user, dto);
  }

  @Get('class/:classStreamId')
  forClass(
    @Param('classStreamId', ParseUUIDPipe) classStreamId: string,
    @Query('academicYear', ParseIntPipe) academicYear: number
  ) {
    return this.service.listTimetableForClass(classStreamId, academicYear);
  }

  @Get('teacher/:teacherId')
  forTeacher(
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Query('academicYear', ParseIntPipe) academicYear: number
  ) {
    return this.service.listTimetableForTeacher(teacherId, academicYear);
  }
}

@Controller('leave-requests')
export class LeaveRequestsController {
  constructor(private readonly service: SchoolAdminService) {}

  @Post()
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createLeaveRequestSchema)) dto: CreateLeaveRequestDto
  ) {
    return this.service.submitLeaveRequest(user, dto);
  }

  @Get('staff/:staffId')
  listForStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Param('staffId', ParseUUIDPipe) staffId: string
  ) {
    return this.service.listMyLeaveRequests(user, staffId);
  }

  @Patch(':id/decision')
  decide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(decideLeaveRequestSchema)) dto: DecideLeaveRequestDto
  ) {
    return this.service.decideLeaveRequest(user, id, dto);
  }
}

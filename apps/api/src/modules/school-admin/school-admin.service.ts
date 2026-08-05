import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import type {
  CreateLeaveRequestDto,
  CreateRoomDto,
  CreateTimetableSlotDto,
  DecideLeaveRequestDto
} from './school-admin.dto';
import { SchoolAdminRepository } from './school-admin.repository';
import type { LeaveRequest, Room, TimetableSlot } from './school-admin.types';

const ADMIN_ROLES = new Set(['school_admin', 'principal', 'platform_admin']);
const STAFF_ROLES = new Set(['teacher', 'school_admin', 'principal', 'platform_admin']);

const toMinutes = (hhmm: string): number => {
  const parts = hhmm.split(':').map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  return h * 60 + m;
};

@Injectable()
export class SchoolAdminService {
  constructor(private readonly repo: SchoolAdminRepository) {}

  private requireAdmin(user: AuthenticatedUser): void {
    if (!ADMIN_ROLES.has(user.role)) {
      throw new ForbiddenException('Only school administration can perform this action');
    }
  }

  // ---------------- rooms ----------------

  async createRoom(user: AuthenticatedUser, dto: CreateRoomDto): Promise<Room> {
    this.requireAdmin(user);
    return this.repo.createRoom(dto);
  }

  listRooms(): Promise<Room[]> {
    return this.repo.listRooms();
  }

  // ---------------- timetable ----------------

  async createTimetableSlot(
    user: AuthenticatedUser,
    dto: CreateTimetableSlotDto
  ): Promise<TimetableSlot> {
    if (!STAFF_ROLES.has(user.role)) {
      throw new ForbiddenException('Only school administration or teachers can perform this action');
    }
    if (!ADMIN_ROLES.has(user.role) && dto.teacherId !== user.userId) {
      throw new ForbiddenException('Teachers can only create timetable slots for themselves');
    }
    return this.repo.createTimetableSlot({
      classStreamId: dto.classStreamId,
      courseId: dto.courseId,
      teacherId: dto.teacherId,
      roomId: dto.roomId,
      academicYear: dto.academicYear,
      dayOfWeek: dto.dayOfWeek,
      startMin: toMinutes(dto.startTime),
      endMin: toMinutes(dto.endTime)
    });
  }

  listTimetableForClass(classStreamId: string, academicYear: number): Promise<TimetableSlot[]> {
    return this.repo.listTimetableForClass(classStreamId, academicYear);
  }

  /**
   * Real gap closed here, same pattern as listMyLeaveRequests above:
   * this previously had NO authorization check at all — any tenant
   * member, including an unrelated student, could view any teacher's
   * schedule by knowing their user id. Less sensitive than the
   * attendance case (a schedule isn't private data the way a
   * specific student's records are), but still worth the same fix
   * rather than leaving it open by omission.
   */
  listTimetableForTeacher(user: AuthenticatedUser, teacherId: string, academicYear: number) {
    if (teacherId !== user.userId && !ADMIN_ROLES.has(user.role)) {
      throw new ForbiddenException('You can only view your own timetable');
    }
    return this.repo.listTimetableForTeacher(teacherId, academicYear);
  }

  // ---------------- leave requests ----------------

  async submitLeaveRequest(
    user: AuthenticatedUser,
    dto: CreateLeaveRequestDto
  ): Promise<LeaveRequest> {
    if (!STAFF_ROLES.has(user.role)) {
      throw new ForbiddenException('Only staff can submit leave requests');
    }
    return this.repo.createLeaveRequest({ ...dto, staffId: user.userId });
  }

  async listMyLeaveRequests(user: AuthenticatedUser, targetStaffId: string): Promise<LeaveRequest[]> {
    if (targetStaffId !== user.userId && !ADMIN_ROLES.has(user.role)) {
      throw new ForbiddenException("You can only view your own leave requests");
    }
    return this.repo.listLeaveRequestsForStaff(targetStaffId);
  }

  listPendingLeaveRequests(user: AuthenticatedUser) {
    this.requireAdmin(user);
    return this.repo.listPendingLeaveRequests();
  }

  async decideLeaveRequest(
    user: AuthenticatedUser,
    id: string,
    dto: DecideLeaveRequestDto
  ): Promise<LeaveRequest> {
    this.requireAdmin(user);
    const existing = await this.repo.findLeaveRequest(id);
    if (!existing) throw new NotFoundException('Leave request not found');
    if (existing.staffId === user.userId) {
      throw new ForbiddenException('You cannot approve your own leave request');
    }
    const ok = await this.repo.decideLeaveRequest(id, { status: dto.status, decidedBy: user.userId });
    if (!ok) throw new NotFoundException('Leave request is not pending');
    return (await this.repo.findLeaveRequest(id))!;
  }
}

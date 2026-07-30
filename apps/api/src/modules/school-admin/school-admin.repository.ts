import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable } from '@nestjs/common';
import { AuditService } from '../../core/audit/audit.service';
import { DatabaseService } from '../../core/database/database.service';
import type {
  LeaveRequest,
  LeaveStatus,
  LeaveType,
  Room,
  RoomType,
  TimetableSlot
} from './school-admin.types';

/** Postgres SQLSTATE for exclusion_violation (EXCLUDE constraint hit). */
const EXCLUSION_VIOLATION = '23P01';

const CONFLICT_MESSAGES: Record<string, string> = {
  no_teacher_double_booking: 'This teacher is already scheduled for an overlapping time slot.',
  no_room_double_booking: 'This room is already booked for an overlapping time slot.',
  no_class_stream_double_booking: 'This class already has a lesson scheduled for an overlapping time slot.'
};

interface RoomRow {
  id: string;
  name: string;
  capacity: number | null;
  room_type: RoomType;
}
const toRoom = (r: RoomRow): Room => ({
  id: r.id,
  name: r.name,
  capacity: r.capacity,
  roomType: r.room_type
});

interface SlotRow {
  id: string;
  class_stream_id: string;
  course_id: string;
  teacher_id: string;
  room_id: string;
  academic_year: number;
  day_of_week: number;
  start_min: number;
  end_min: number;
}
const toSlot = (r: SlotRow): TimetableSlot => ({
  id: r.id,
  classStreamId: r.class_stream_id,
  courseId: r.course_id,
  teacherId: r.teacher_id,
  roomId: r.room_id,
  academicYear: r.academic_year,
  dayOfWeek: r.day_of_week,
  startMin: r.start_min,
  endMin: r.end_min
});

interface LeaveRow {
  id: string;
  staff_id: string;
  leave_type: LeaveType;
  start_date: Date;
  end_date: Date;
  reason: string | null;
  status: LeaveStatus;
  decided_by: string | null;
  decided_at: Date | null;
}
const toLeave = (r: LeaveRow): LeaveRequest => ({
  id: r.id,
  staffId: r.staff_id,
  leaveType: r.leave_type,
  startDate: r.start_date.toISOString().slice(0, 10),
  endDate: r.end_date.toISOString().slice(0, 10),
  reason: r.reason,
  status: r.status,
  decidedBy: r.decided_by,
  decidedAt: r.decided_at ? r.decided_at.toISOString() : null
});

interface PgErrorLike {
  code?: string;
  constraint?: string;
}

@Injectable()
export class SchoolAdminRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService
  ) {}

  // ---------------- rooms ----------------

  async createRoom(input: { name: string; capacity?: number; roomType: RoomType }): Promise<Room> {
    return this.db.withTenantTransaction(async (client) => {
      const id = randomUUID();
      const { rows } = await client.query<RoomRow>(
        `INSERT INTO schooladmin.rooms (id, tenant_id, name, capacity, room_type)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4)
         RETURNING *`,
        [id, input.name, input.capacity ?? null, input.roomType]
      );
      await this.audit.record(client, {
        action: 'room.created',
        entityType: 'room',
        entityId: id,
        after: { name: input.name }
      });
      return toRoom(rows[0]!);
    });
  }

  async listRooms(): Promise<Room[]> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<RoomRow>(
        `SELECT * FROM schooladmin.rooms
          WHERE tenant_id = core.current_tenant_id() AND deleted_at IS NULL
          ORDER BY name`
      );
      return rows.map(toRoom);
    });
  }

  // ---------------- timetable ----------------

  /**
   * Relies entirely on the three EXCLUDE constraints in migration 0008
   * for conflict detection — no application-level overlap check is
   * duplicated here. A Postgres exclusion_violation (23P01) is caught
   * and translated into a friendly 409, with the constraint name
   * mapped to a specific message (teacher vs room vs class conflict).
   */
  async createTimetableSlot(input: {
    classStreamId: string;
    courseId: string;
    teacherId: string;
    roomId: string;
    academicYear: number;
    dayOfWeek: number;
    startMin: number;
    endMin: number;
  }): Promise<TimetableSlot> {
    try {
      return await this.db.withTenantTransaction(async (client) => {
        const id = randomUUID();
        const { rows } = await client.query<SlotRow>(
          `INSERT INTO schooladmin.timetable_slots
             (id, tenant_id, class_stream_id, course_id, teacher_id, room_id,
              academic_year, day_of_week, start_min, end_min)
           VALUES ($1, core.current_tenant_id(), $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [
            id,
            input.classStreamId,
            input.courseId,
            input.teacherId,
            input.roomId,
            input.academicYear,
            input.dayOfWeek,
            input.startMin,
            input.endMin
          ]
        );
        await this.audit.record(client, {
          action: 'timetable_slot.created',
          entityType: 'timetable_slot',
          entityId: id,
          after: { dayOfWeek: input.dayOfWeek, startMin: input.startMin, endMin: input.endMin }
        });
        return toSlot(rows[0]!);
      });
    } catch (err) {
      const pgErr = err as PgErrorLike;
      if (pgErr.code === EXCLUSION_VIOLATION) {
        const message = pgErr.constraint ? CONFLICT_MESSAGES[pgErr.constraint] : undefined;
        throw new ConflictException(message ?? 'This slot conflicts with an existing booking.');
      }
      throw err;
    }
  }

  async listTimetableForClass(classStreamId: string, academicYear: number): Promise<TimetableSlot[]> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<SlotRow>(
        `SELECT * FROM schooladmin.timetable_slots
          WHERE class_stream_id = $1 AND academic_year = $2
            AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL
          ORDER BY day_of_week, start_min`,
        [classStreamId, academicYear]
      );
      return rows.map(toSlot);
    });
  }

  async listTimetableForTeacher(teacherId: string, academicYear: number): Promise<TimetableSlot[]> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<SlotRow>(
        `SELECT * FROM schooladmin.timetable_slots
          WHERE teacher_id = $1 AND academic_year = $2
            AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL
          ORDER BY day_of_week, start_min`,
        [teacherId, academicYear]
      );
      return rows.map(toSlot);
    });
  }

  // ---------------- leave requests ----------------

  async createLeaveRequest(input: {
    staffId: string;
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    reason?: string;
  }): Promise<LeaveRequest> {
    return this.db.withTenantTransaction(async (client) => {
      const id = randomUUID();
      const { rows } = await client.query<LeaveRow>(
        `INSERT INTO schooladmin.leave_requests
           (id, tenant_id, staff_id, leave_type, start_date, end_date, reason)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4, $5, $6)
         RETURNING *`,
        [id, input.staffId, input.leaveType, input.startDate, input.endDate, input.reason ?? null]
      );
      await this.audit.record(client, {
        action: 'leave_request.submitted',
        entityType: 'leave_request',
        entityId: id,
        after: { leaveType: input.leaveType }
      });
      return toLeave(rows[0]!);
    });
  }

  async findLeaveRequest(id: string): Promise<LeaveRequest | null> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<LeaveRow>(
        `SELECT * FROM schooladmin.leave_requests
          WHERE id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL`,
        [id]
      );
      return rows[0] ? toLeave(rows[0]) : null;
    });
  }

  async decideLeaveRequest(
    id: string,
    input: { status: 'approved' | 'rejected'; decidedBy: string }
  ): Promise<boolean> {
    return this.db.withTenantTransaction(async (client) => {
      const res = await client.query(
        `UPDATE schooladmin.leave_requests
            SET status = $2, decided_by = $3, decided_at = now()
          WHERE id = $1 AND tenant_id = core.current_tenant_id() AND status = 'pending'`,
        [id, input.status, input.decidedBy]
      );
      if ((res.rowCount ?? 0) === 1) {
        await this.audit.record(client, {
          action: 'leave_request.decided',
          entityType: 'leave_request',
          entityId: id,
          after: { status: input.status }
        });
      }
      return res.rowCount === 1;
    });
  }

  async listLeaveRequestsForStaff(staffId: string): Promise<LeaveRequest[]> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<LeaveRow>(
        `SELECT * FROM schooladmin.leave_requests
          WHERE staff_id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL
          ORDER BY start_date DESC`,
        [staffId]
      );
      return rows.map(toLeave);
    });
  }
}

import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { AuditService } from '../../core/audit/audit.service';
import { DatabaseService } from '../../core/database/database.service';
import type { AttendanceRecord, AttendanceStatus, LessonPlan } from './teacher-portal.types';

interface AttendanceRow {
  id: string;
  class_stream_id: string;
  learner_id: string;
  attendance_date: Date;
  status: AttendanceStatus;
  recorded_by: string;
  row_version: string;
}
const toAttendance = (r: AttendanceRow): AttendanceRecord => ({
  id: r.id,
  classStreamId: r.class_stream_id,
  learnerId: r.learner_id,
  attendanceDate: r.attendance_date.toISOString().slice(0, 10),
  status: r.status,
  recordedBy: r.recorded_by,
  rowVersion: r.row_version
});

interface LessonPlanRow {
  id: string;
  course_id: string;
  teacher_id: string;
  week_of: Date;
  objectives: string | null;
  activities: unknown[];
  resources: string | null;
  status: LessonPlan['status'];
  ai_generated: boolean;
}
const toLessonPlan = (r: LessonPlanRow): LessonPlan => ({
  id: r.id,
  courseId: r.course_id,
  teacherId: r.teacher_id,
  weekOf: r.week_of.toISOString().slice(0, 10),
  objectives: r.objectives,
  activities: r.activities,
  resources: r.resources,
  status: r.status,
  aiGenerated: r.ai_generated
});

@Injectable()
export class TeacherPortalRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService
  ) {}

  /**
   * LAST-WRITE-WINS: unconditional overwrite on conflict, no version
   * check, no merge. Used identically by the online endpoint and the
   * offline sync handler — see ADR-009. Accepts an optional externally
   * supplied client so the sync handler can call it inside the sync
   * transaction (mirrors LearningRepository.upsertSubmission's shape
   * from Sprint 4).
   */
  async markAttendance(
    input: {
      classStreamId: string;
      learnerId: string;
      attendanceDate: string;
      status: AttendanceStatus;
      recordedBy: string;
    },
    externalClient?: PoolClient
  ): Promise<AttendanceRecord> {
    const run = async (client: PoolClient) => {
      const { rows } = await client.query<AttendanceRow>(
        `INSERT INTO teacherportal.attendance_records
           (id, tenant_id, class_stream_id, learner_id, attendance_date, status, recorded_by)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4, $5, $6)
         ON CONFLICT (class_stream_id, learner_id, attendance_date)
         DO UPDATE SET status = EXCLUDED.status, recorded_by = EXCLUDED.recorded_by
         RETURNING *`,
        [
          randomUUID(),
          input.classStreamId,
          input.learnerId,
          input.attendanceDate,
          input.status,
          input.recordedBy
        ]
      );
      await this.audit.record(client, {
        action: 'attendance.marked',
        entityType: 'attendance_record',
        entityId: rows[0]!.id,
        after: { status: input.status, date: input.attendanceDate }
      });
      return toAttendance(rows[0]!);
    };
    return externalClient ? run(externalClient) : this.db.withTenantTransaction(run);
  }

  async listAttendanceForClassOnDate(
    classStreamId: string,
    date: string
  ): Promise<AttendanceRecord[]> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<AttendanceRow>(
        `SELECT * FROM teacherportal.attendance_records
          WHERE class_stream_id = $1 AND attendance_date = $2
            AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL`,
        [classStreamId, date]
      );
      return rows.map(toAttendance);
    });
  }

  async listAttendanceForLearner(learnerId: string, limit = 90): Promise<AttendanceRecord[]> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<AttendanceRow>(
        `SELECT * FROM teacherportal.attendance_records
          WHERE learner_id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL
          ORDER BY attendance_date DESC
          LIMIT $2`,
        [learnerId, limit]
      );
      return rows.map(toAttendance);
    });
  }

  /** Attendance rate for one learner in a given academic year — the population Early Warning scans. */
  async getAttendanceRateForLearner(
    learnerId: string,
    academicYear: number
  ): Promise<{ recordedDays: number; presentOrLateDays: number } | null> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{ recorded: string; present_or_late: string }>(
        `SELECT count(*)::int AS recorded,
                count(*) FILTER (WHERE status IN ('present', 'late'))::int AS present_or_late
           FROM teacherportal.attendance_records
          WHERE learner_id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL
            AND extract(year FROM attendance_date)::int = $2::int`,
        [learnerId, academicYear]
      );
      const row = rows[0];
      if (!row || Number(row.recorded) === 0) return null;
      return { recordedDays: Number(row.recorded), presentOrLateDays: Number(row.present_or_late) };
    });
  }

  async createLessonPlan(input: {
    courseId: string;
    teacherId: string;
    weekOf: string;
    objectives?: string;
    activities: Record<string, unknown>[];
    resources?: string;
    aiGenerated?: boolean;
  }): Promise<LessonPlan> {
    return this.db.withTenantTransaction(async (client) => {
      const id = randomUUID();
      const { rows } = await client.query<LessonPlanRow>(
        `INSERT INTO teacherportal.lesson_plans
           (id, tenant_id, course_id, teacher_id, week_of, objectives, activities, resources, ai_generated)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4, $5, $6::jsonb, $7, $8)
         ON CONFLICT (course_id, teacher_id, week_of) DO UPDATE SET
           objectives = EXCLUDED.objectives, activities = EXCLUDED.activities,
           resources = EXCLUDED.resources, ai_generated = EXCLUDED.ai_generated
         RETURNING *`,
        [
          id,
          input.courseId,
          input.teacherId,
          input.weekOf,
          input.objectives ?? null,
          JSON.stringify(input.activities),
          input.resources ?? null,
          input.aiGenerated ?? false
        ]
      );
      await this.audit.record(client, {
        action: 'lesson_plan.saved',
        entityType: 'lesson_plan',
        entityId: rows[0]!.id,
        after: { courseId: input.courseId, weekOf: input.weekOf, aiGenerated: input.aiGenerated ?? false }
      });
      return toLessonPlan(rows[0]!);
    });
  }

  async listLessonPlansForCourse(courseId: string): Promise<LessonPlan[]> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<LessonPlanRow>(
        `SELECT * FROM teacherportal.lesson_plans
          WHERE course_id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL
          ORDER BY week_of`,
        [courseId]
      );
      return rows.map(toLessonPlan);
    });
  }

  async updateLessonPlanStatus(id: string, status: LessonPlan['status']): Promise<LessonPlan | null> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<LessonPlanRow>(
        `UPDATE teacherportal.lesson_plans SET status = $2
          WHERE id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL
          RETURNING *`,
        [id, status]
      );
      if (!rows[0]) return null;
      await this.audit.record(client, {
        action: 'lesson_plan.status_changed',
        entityType: 'lesson_plan',
        entityId: id,
        after: { status }
      });
      return toLessonPlan(rows[0]);
    });
  }
}

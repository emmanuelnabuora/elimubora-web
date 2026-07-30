import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { WorkerDatabaseService } from '../../core/database/worker-database.service';
import type { AttendanceSnapshot, EnrollmentSnapshot } from './government.types';

interface EnrollmentRow extends Record<string, unknown> {
  county_code: string | null;
  academic_year: number;
  total_students: string;
  total_schools: string;
  snapshot_taken_at: Date;
}
const toEnrollment = (r: EnrollmentRow): EnrollmentSnapshot => ({
  countyCode: r.county_code,
  academicYear: r.academic_year,
  totalStudents: Number(r.total_students),
  totalSchools: Number(r.total_schools),
  snapshotTakenAt: r.snapshot_taken_at.toISOString()
});

interface AttendanceRow extends Record<string, unknown> {
  county_code: string | null;
  academic_year: number;
  average_attendance_rate: string;
  snapshot_taken_at: Date;
}
const toAttendance = (r: AttendanceRow): AttendanceSnapshot => ({
  countyCode: r.county_code,
  academicYear: r.academic_year,
  averageAttendanceRate: r.average_attendance_rate,
  snapshotTakenAt: r.snapshot_taken_at.toISOString()
});

@Injectable()
export class GovernmentRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly workerDb: WorkerDatabaseService
  ) {}

  /** Untenanted read — core.tenants carries no RLS (Sprint 1). */
  async findTenantScope(tenantId: string): Promise<{ kind: string; countyCode: string | null } | null> {
    const { rows } = await this.db.query<{ kind: string; county_code: string | null }>(
      'SELECT kind, county_code FROM core.tenants WHERE id = $1 AND deleted_at IS NULL',
      [tenantId]
    );
    const r = rows[0];
    return r ? { kind: r.kind, countyCode: r.county_code } : null;
  }

  /**
   * Computes county-level and national enrollment rollups via the
   * WORKER role (cross-tenant read across every school), then writes
   * both into gov.enrollment_snapshots. Only the worker role can
   * INSERT here — see migration 0016.
   */
  async refreshEnrollment(academicYear: number): Promise<void> {
    await this.workerDb.query(
      `INSERT INTO gov.enrollment_snapshots (county_code, academic_year, total_students, total_schools)
       SELECT t.county_code, $1,
              count(DISTINCT sp.student_id) FILTER (WHERE sp.status = 'active'),
              count(DISTINCT t.id)
         FROM core.tenants t
         LEFT JOIN sis.student_profiles sp
           ON sp.tenant_id = t.id AND sp.deleted_at IS NULL
        WHERE t.kind = 'school' AND t.deleted_at IS NULL
        GROUP BY t.county_code`,
      [academicYear]
    );
    await this.workerDb.query(
      `INSERT INTO gov.enrollment_snapshots (county_code, academic_year, total_students, total_schools)
       SELECT NULL, $1,
              count(DISTINCT sp.student_id) FILTER (WHERE sp.status = 'active'),
              count(DISTINCT t.id)
         FROM core.tenants t
         LEFT JOIN sis.student_profiles sp
           ON sp.tenant_id = t.id AND sp.deleted_at IS NULL
        WHERE t.kind = 'school' AND t.deleted_at IS NULL`,
      [academicYear]
    );
  }

  /**
   * Computes county-level and national attendance rate rollups for a
   * given academic year via the WORKER role, from every school's
   * attendance_records.
   */
  async refreshAttendance(academicYear: number): Promise<void> {
    await this.workerDb.query(
      `INSERT INTO gov.attendance_snapshots (county_code, academic_year, average_attendance_rate)
       SELECT t.county_code, $1::int,
              round(100.0 * count(*) FILTER (WHERE ar.status IN ('present', 'late'))
                    / NULLIF(count(*), 0), 2)
         FROM core.tenants t
         JOIN teacherportal.attendance_records ar
           ON ar.tenant_id = t.id AND ar.deleted_at IS NULL
        WHERE t.kind = 'school' AND t.deleted_at IS NULL
          AND extract(year FROM ar.attendance_date)::int = $1::int
        GROUP BY t.county_code
       HAVING count(*) > 0`,
      [academicYear]
    );
    await this.workerDb.query(
      `INSERT INTO gov.attendance_snapshots (county_code, academic_year, average_attendance_rate)
       SELECT NULL, $1::int,
              round(100.0 * count(*) FILTER (WHERE ar.status IN ('present', 'late'))
                    / NULLIF(count(*), 0), 2)
         FROM core.tenants t
         JOIN teacherportal.attendance_records ar
           ON ar.tenant_id = t.id AND ar.deleted_at IS NULL
        WHERE t.kind = 'school' AND t.deleted_at IS NULL
          AND extract(year FROM ar.attendance_date)::int = $1::int
       HAVING count(*) > 0`,
      [academicYear]
    );
  }

  /** Latest snapshot for the given year/county (or the latest national row if countyCode is null). */
  async findLatestEnrollment(academicYear: number, countyCode: string | null): Promise<EnrollmentSnapshot | null> {
    const { rows } = await this.db.query<EnrollmentRow>(
      `SELECT * FROM gov.enrollment_snapshots
        WHERE academic_year = $1 AND county_code IS NOT DISTINCT FROM $2
        ORDER BY snapshot_taken_at DESC
        LIMIT 1`,
      [academicYear, countyCode]
    );
    return rows[0] ? toEnrollment(rows[0]) : null;
  }

  async findLatestAttendance(academicYear: number, countyCode: string | null): Promise<AttendanceSnapshot | null> {
    const { rows } = await this.db.query<AttendanceRow>(
      `SELECT * FROM gov.attendance_snapshots
        WHERE academic_year = $1 AND county_code IS NOT DISTINCT FROM $2
        ORDER BY snapshot_taken_at DESC
        LIMIT 1`,
      [academicYear, countyCode]
    );
    return rows[0] ? toAttendance(rows[0]) : null;
  }

  /** All counties' latest snapshots for a year — the national dashboard's per-county breakdown. */
  async listLatestEnrollmentByCounty(academicYear: number): Promise<EnrollmentSnapshot[]> {
    const { rows } = await this.db.query<EnrollmentRow>(
      `SELECT DISTINCT ON (county_code) *
         FROM gov.enrollment_snapshots
        WHERE academic_year = $1 AND county_code IS NOT NULL
        ORDER BY county_code, snapshot_taken_at DESC`,
      [academicYear]
    );
    return rows.map(toEnrollment);
  }
}

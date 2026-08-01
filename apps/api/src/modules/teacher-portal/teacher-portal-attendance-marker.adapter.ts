import { Injectable } from '@nestjs/common';
import type { AttendanceMarker } from '../../core/attendance/attendance-marker.port';
import { TeacherPortalRepository } from './teacher-portal.repository';

/**
 * Concrete implementation of core's AttendanceMarker port. Lives
 * here, not in core, because attendance_records is Teacher Portal's
 * owned data — core only defines the interface. Bound to the port
 * token at the composition layer, not exported for direct import by
 * other domain modules.
 */
@Injectable()
export class TeacherPortalAttendanceMarker implements AttendanceMarker {
  constructor(private readonly repo: TeacherPortalRepository) {}

  async markPresent(input: {
    classStreamId: string;
    learnerId: string;
    attendanceDate: string;
    recordedBy: string;
  }): Promise<void> {
    // Same last-write-wins path every attendance mark uses (ADR-009) —
    // a QR check-in is just another way to record it, not a parallel mechanism.
    await this.repo.markAttendance({ ...input, status: 'present' });
  }
}

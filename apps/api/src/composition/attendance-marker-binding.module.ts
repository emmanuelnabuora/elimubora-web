import { Global, Module } from '@nestjs/common';
import { ATTENDANCE_MARKER } from '../core/attendance/attendance-marker.port';
import { TeacherPortalAttendanceMarker } from '../modules/teacher-portal/teacher-portal-attendance-marker.adapter';
import { TeacherPortalModule } from '../modules/teacher-portal/teacher-portal.module';

/**
 * Binds core's ATTENDANCE_MARKER port to Teacher Portal's concrete
 * implementation, and makes that binding globally available — so
 * modules/mobile can inject the port without ever importing
 * modules/teacher-portal directly (module boundary). This module
 * performs no business logic of its own, only DI wiring, which is
 * why it's reasonable for it to import a domain module despite
 * living alongside composition/ (whose other members are read
 * aggregation, per ADR-008) — there's nothing here for the
 * modules-cannot-import-composition rule to protect against in the
 * reverse direction, since this module exposes no read/write surface
 * of its own at all.
 */
@Global()
@Module({
  imports: [TeacherPortalModule],
  providers: [{ provide: ATTENDANCE_MARKER, useExisting: TeacherPortalAttendanceMarker }],
  exports: [ATTENDANCE_MARKER]
})
export class AttendanceMarkerBindingModule {}

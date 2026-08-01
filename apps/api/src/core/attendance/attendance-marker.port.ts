/**
 * A narrow port for marking attendance, owned conceptually by
 * Teacher Portal's data (teacherportal.attendance_records) but
 * needed by modules/mobile (QR check-in), which cannot import
 * modules/teacher-portal directly (module boundary). Same pattern as
 * the AI/payment/push/storage ports: an interface in core, a
 * concrete implementation provided by the module that owns the data,
 * bound together at the composition layer (see
 * composition/attendance-marker-binding.module.ts) rather than
 * modules/mobile importing modules/teacher-portal directly.
 */
export interface AttendanceMarker {
  markPresent(input: {
    classStreamId: string;
    learnerId: string;
    attendanceDate: string;
    recordedBy: string;
  }): Promise<void>;
}

export const ATTENDANCE_MARKER = Symbol('ATTENDANCE_MARKER');

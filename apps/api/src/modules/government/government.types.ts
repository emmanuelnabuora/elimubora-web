export interface EnrollmentSnapshot {
  countyCode: string | null;
  academicYear: number;
  totalStudents: number;
  totalSchools: number;
  snapshotTakenAt: string;
}

export interface AttendanceSnapshot {
  countyCode: string | null;
  academicYear: number;
  averageAttendanceRate: string;
  snapshotTakenAt: string;
}

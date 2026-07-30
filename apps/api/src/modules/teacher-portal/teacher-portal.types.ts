export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type LessonPlanStatus = 'draft' | 'submitted' | 'approved';

export interface AttendanceRecord {
  id: string;
  classStreamId: string;
  learnerId: string;
  attendanceDate: string;
  status: AttendanceStatus;
  recordedBy: string;
  rowVersion: string;
}

export interface LessonPlan {
  id: string;
  courseId: string;
  teacherId: string;
  weekOf: string;
  objectives: string | null;
  activities: unknown[];
  resources: string | null;
  status: LessonPlanStatus;
  aiGenerated: boolean;
}

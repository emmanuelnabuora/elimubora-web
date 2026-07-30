export type RoomType = 'classroom' | 'lab' | 'hall' | 'office' | 'other';
export type LeaveType = 'sick' | 'annual' | 'compassionate' | 'maternity' | 'paternity' | 'unpaid';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface Room {
  id: string;
  name: string;
  capacity: number | null;
  roomType: RoomType;
}

export interface TimetableSlot {
  id: string;
  classStreamId: string;
  courseId: string;
  teacherId: string;
  roomId: string;
  academicYear: number;
  dayOfWeek: number;
  startMin: number;
  endMin: number;
}

export interface LeaveRequest {
  id: string;
  staffId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: LeaveStatus;
  decidedBy: string | null;
  decidedAt: string | null;
}

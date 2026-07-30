export type StudentStatus = 'active' | 'transferred_out' | 'graduated' | 'withdrawn';
export type ApplicationStatus = 'submitted' | 'under_review' | 'admitted' | 'rejected' | 'waitlisted';
export type TransferStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface Guardian {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  nationalId: string | null;
  userId: string | null;
}

export interface StudentProfile {
  studentId: string;
  admissionNumber: string;
  dateOfBirth: string | null;
  gender: 'male' | 'female' | null;
  status: StudentStatus;
  enrolledAt: string;
}

export interface StudentMedical {
  studentId: string;
  bloodGroup: string | null;
  allergies: string | null;
  medicalNotes: string | null;
}

export interface ClassStream {
  id: string;
  name: string;
  gradeLevel: string;
  academicYear: number;
  homeroomTeacherId: string | null;
}

export interface AdmissionApplication {
  id: string;
  candidateName: string;
  dateOfBirth: string | null;
  guardianName: string;
  guardianPhone: string;
  gradeLevelApplied: string;
  status: ApplicationStatus;
  reviewedBy: string | null;
  decidedAt: string | null;
  notes: string | null;
}

export interface Transfer {
  id: string;
  fromTenantId: string;
  toTenantId: string;
  studentId: string;
  requestedBy: string;
  status: TransferStatus;
  reason: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
}

export type BehaviourCategory = 'positive' | 'concern' | 'incident';

export interface BehaviourNote {
  id: string;
  studentId: string;
  category: BehaviourCategory;
  note: string;
  recordedBy: string;
  occurredAt: string;
}

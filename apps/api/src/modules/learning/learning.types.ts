export type CourseStatus = 'draft' | 'published' | 'archived';
export type CourseRole = 'learner' | 'teacher';
export type SubmissionStatus = 'submitted' | 'graded' | 'returned';
/** CBC performance levels: Exceeding / Meeting / Approaching / Below Expectation. */
export type CbcLevel = 'EE' | 'ME' | 'AE' | 'BE';

export interface Course {
  id: string;
  title: string;
  description: string | null;
  learningArea: string;
  gradeLevel: string;
  status: CourseStatus;
  createdBy: string;
  rowVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface CourseModuleRecord {
  id: string;
  courseId: string;
  title: string;
  position: number;
  rowVersion: string;
}

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  position: number;
  content: Record<string, unknown>;
  rowVersion: string;
}

export interface Competency {
  id: string;
  code: string;
  title: string;
  strand: string;
  subStrand: string | null;
}

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  instructions: string | null;
  dueAt: string | null;
  maxScore: string;
  rubric: Record<string, unknown> | null;
  competencyIds: string[];
  rowVersion: string;
}

export interface Enrollment {
  id: string;
  courseId: string;
  userId: string;
  courseRole: CourseRole;
}

export interface Submission {
  id: string;
  assignmentId: string;
  learnerId: string;
  content: Record<string, unknown>;
  status: SubmissionStatus;
  submittedAt: string;
  score: string | null;
  rubricLevels: Record<string, CbcLevel> | null;
  feedback: string | null;
  gradedBy: string | null;
  gradedAt: string | null;
  rowVersion: string;
}

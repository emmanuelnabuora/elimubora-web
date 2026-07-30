export type QuestionType = 'mcq' | 'short_answer' | 'essay';
export type ExamStatus = 'draft' | 'published' | 'closed';
export type AttemptStatus = 'in_progress' | 'submitted' | 'graded';

export interface QuestionOption {
  id: string;
  text: string;
}

export interface QuestionBank {
  id: string;
  title: string;
  subject: string;
  gradeLevel: string;
  createdBy: string;
}

export type ReviewStatus = 'approved' | 'pending' | 'rejected';

export interface Question {
  id: string;
  bankId: string;
  questionType: QuestionType;
  prompt: string;
  options: QuestionOption[] | null;
  /** Never returned to learners — see AssessmentService.stripAnswerKey. */
  correctOptionId: string | null;
  marks: string;
  competencyIds: string[];
  aiGenerated: boolean;
  reviewStatus: ReviewStatus;
}

/** The shape a learner is allowed to see: no answer key. */
export type QuestionForLearner = Omit<Question, 'correctOptionId'>;

export interface Exam {
  id: string;
  courseId: string;
  questionBankId: string;
  title: string;
  durationMinutes: number;
  questionCount: number;
  status: ExamStatus;
  createdBy: string;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  learnerId: string;
  questionIds: string[];
  answers: Record<string, string>;
  status: AttemptStatus;
  startedAt: string;
  submittedAt: string | null;
  autoScore: string;
  manualScore: string;
  finalScore: string;
  gradedBy: string | null;
  gradedAt: string | null;
}

export interface Certificate {
  id: string;
  studentId: string;
  title: string;
  certificateNumber: string;
  awardedBy: string;
  issuedAt: string;
}

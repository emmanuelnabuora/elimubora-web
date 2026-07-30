import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import type {
  CreateExamDto,
  CreateQuestionBankDto,
  CreateQuestionDto,
  GradeAttemptDto,
  IssueCertificateDto,
  SubmitAttemptDto
} from './assessment.dto';
import { AssessmentRepository } from './assessment.repository';
import type {
  Certificate,
  Exam,
  ExamAttempt,
  Question,
  QuestionBank,
  QuestionForLearner
} from './assessment.types';

const STAFF_ROLES = new Set(['teacher', 'school_admin', 'principal', 'platform_admin']);

/** Never send the answer key to a learner sitting the exam. */
function stripAnswerKey(q: Question): QuestionForLearner {
  const { correctOptionId: _correctOptionId, ...rest } = q;
  return rest;
}

@Injectable()
export class AssessmentService {
  constructor(private readonly repo: AssessmentRepository) {}

  private requireStaff(user: AuthenticatedUser): void {
    if (!STAFF_ROLES.has(user.role)) {
      throw new ForbiddenException('Only teaching staff can perform this action');
    }
  }

  // ---------------- question banks & questions ----------------

  async createQuestionBank(
    user: AuthenticatedUser,
    dto: CreateQuestionBankDto
  ): Promise<QuestionBank> {
    this.requireStaff(user);
    return this.repo.createQuestionBank({ ...dto, createdBy: user.userId });
  }

  async createQuestion(
    user: AuthenticatedUser,
    bankId: string,
    dto: CreateQuestionDto
  ): Promise<Question> {
    this.requireStaff(user);
    const bank = await this.repo.findQuestionBank(bankId);
    if (!bank) throw new NotFoundException('Question bank not found');
    return this.repo.createQuestion({ ...dto, bankId });
  }

  // ---------------- exams ----------------

  async createExam(user: AuthenticatedUser, dto: CreateExamDto): Promise<Exam> {
    this.requireStaff(user);
    const bank = await this.repo.findQuestionBank(dto.questionBankId);
    if (!bank) throw new NotFoundException('Question bank not found');
    const available = await this.repo.countQuestionsInBank(dto.questionBankId);
    if (available < dto.questionCount) {
      throw new BadRequestException(
        `Question bank has only ${available} questions but the exam requires ${dto.questionCount}`
      );
    }
    return this.repo.createExam({ ...dto, createdBy: user.userId });
  }

  async getExam(id: string): Promise<Exam> {
    const exam = await this.repo.findExam(id);
    if (!exam) throw new NotFoundException('Exam not found');
    return exam;
  }

  async updateExamStatus(user: AuthenticatedUser, id: string, status: Exam['status']): Promise<Exam> {
    this.requireStaff(user);
    const updated = await this.repo.updateExamStatus(id, status);
    if (!updated) throw new NotFoundException('Exam not found');
    return updated;
  }

  // ---------------- attempts ----------------

  /**
   * Any learner in the tenant may start an attempt on a published
   * exam. This is a coarse-grained simplification consistent with
   * Teacher Portal's attendance authorization (Sprint 6, ADR-009):
   * verifying the learner is specifically enrolled in the exam's
   * course would require reading Learning's enrollment table, which
   * this module cannot import directly (module boundary). A tighter
   * check is a natural follow-up once a shared enrollment-query port
   * exists in core, mirroring UserProvisioningService's pattern.
   */
  async startAttempt(user: AuthenticatedUser, examId: string): Promise<ExamAttempt> {
    if (user.role !== 'learner') {
      throw new ForbiddenException('Only learners can attempt exams');
    }
    const exam = await this.getExam(examId);
    if (exam.status !== 'published') {
      throw new BadRequestException('This exam is not currently open for attempts');
    }
    return this.repo.startAttempt({
      examId,
      learnerId: user.userId,
      questionCount: exam.questionCount,
      bankId: exam.questionBankId
    });
  }

  /** What the learner sees while attempting: questions, no answer key. */
  async getAttemptQuestions(
    user: AuthenticatedUser,
    attemptId: string
  ): Promise<QuestionForLearner[]> {
    const attempt = await this.repo.findAttempt(attemptId);
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.learnerId !== user.userId) {
      throw new ForbiddenException('This is not your attempt');
    }
    const questions = await this.repo.findQuestionsByIds(attempt.questionIds);
    return questions.map(stripAnswerKey);
  }

  async submitAttempt(
    user: AuthenticatedUser,
    attemptId: string,
    dto: SubmitAttemptDto
  ): Promise<ExamAttempt> {
    const attempt = await this.repo.findAttempt(attemptId);
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.learnerId !== user.userId) {
      throw new ForbiddenException('This is not your attempt');
    }
    const { attempt: submitted } = await this.repo.submitAttempt(attemptId, dto.answers);
    return submitted;
  }

  async listAttemptsForExam(user: AuthenticatedUser, examId: string): Promise<ExamAttempt[]> {
    this.requireStaff(user);
    return this.repo.listAttemptsForExam(examId);
  }

  async gradeAttempt(
    user: AuthenticatedUser,
    attemptId: string,
    dto: GradeAttemptDto
  ): Promise<ExamAttempt> {
    this.requireStaff(user);
    const graded = await this.repo.gradeAttempt(attemptId, dto.manualScore, user.userId);
    if (!graded) throw new NotFoundException('No submitted attempt awaiting grading found');
    return graded;
  }

  // ---------------- certificates ----------------

  async issueCertificate(user: AuthenticatedUser, dto: IssueCertificateDto): Promise<Certificate> {
    this.requireStaff(user);
    return this.repo.issueCertificate({ ...dto, awardedBy: user.userId });
  }

  listCertificates(studentId: string): Promise<Certificate[]> {
    return this.repo.listCertificatesForStudent(studentId);
  }
}

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { AiInteractionLogService } from '../../core/ai/ai-interaction-log.service';
import { AI_PROVIDER, type AiProvider } from '../../core/ai/ai-provider.port';
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
  constructor(
    private readonly repo: AssessmentRepository,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
    private readonly aiLog: AiInteractionLogService
  ) {}

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

  async listQuestionBanks(user: AuthenticatedUser): Promise<QuestionBank[]> {
    this.requireStaff(user);
    return this.repo.listQuestionBanksForTenant();
  }

  async listQuestionsForBank(user: AuthenticatedUser, bankId: string): Promise<Question[]> {
    this.requireStaff(user);
    const bank = await this.repo.findQuestionBank(bankId);
    if (!bank) throw new NotFoundException('Question bank not found');
    return this.repo.listQuestionsForBank(bankId);
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

  /**
   * Drafts an MCQ question via the AI provider — lands with
   * review_status='pending', which the exam draw query treats as
   * structurally unselectable (AssessmentRepository.drawRandomQuestionIds)
   * until a teacher calls reviewQuestion to approve it. The sandbox
   * provider (see ai-provider.port.ts) returns a placeholder, not a
   * real generated question — a teacher reviewing this draft in
   * production is reviewing real AI output, but nothing here fakes that.
   */
  async draftQuestionWithAi(
    user: AuthenticatedUser,
    bankId: string,
    input: { topic: string; marks: number }
  ): Promise<Question> {
    this.requireStaff(user);
    const bank = await this.repo.findQuestionBank(bankId);
    if (!bank) throw new NotFoundException('Question bank not found');

    const result = await this.ai.complete({
      feature: 'exam_question_draft',
      prompt: `Draft one multiple-choice question for ${bank.subject} (${bank.gradeLevel}) on: ${input.topic}`,
      context: { bankId }
    });
    await this.aiLog.record({
      userId: user.userId,
      feature: 'exam_question_draft',
      context: { bankId, topic: input.topic },
      promptSummary: input.topic,
      responseSummary: result.text
    });
    // The sandbox provider returns free text, not a structured MCQ —
    // stored as a short-answer draft (no fabricated options/answer
    // key) pending human review, rather than pretending to parse a
    // real multiple-choice structure out of a placeholder string.
    return this.repo.createQuestion({
      bankId,
      questionType: 'short_answer',
      prompt: result.text,
      marks: input.marks,
      competencyIds: [],
      aiGenerated: true
    });
  }

  async reviewQuestion(
    user: AuthenticatedUser,
    questionId: string,
    status: 'approved' | 'rejected'
  ): Promise<Question> {
    this.requireStaff(user);
    const reviewed = await this.repo.reviewQuestion(questionId, status);
    if (!reviewed) throw new NotFoundException('No pending AI-drafted question found with that id');
    return reviewed;
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

  /** Staff see every exam regardless of status; a learner sees only published ones. */
  async listExams(user: AuthenticatedUser): Promise<Exam[]> {
    const isStaff = STAFF_ROLES.has(user.role);
    return this.repo.listExamsForTenant(!isStaff);
  }

  /**
   * A learner's own exam list, each entry enriched with whatever
   * attempt (if any) they already have on it -- so the UI can show
   * "Start" vs "Continue" vs "Awaiting grading" vs a final score,
   * rather than the frontend needing to separately query every
   * exam's attempt state itself.
   */
  async listExamsForLearner(
    user: AuthenticatedUser
  ): Promise<Array<Exam & { myAttempt: ExamAttempt | null }>> {
    if (user.role !== 'learner') {
      throw new ForbiddenException('Only learners have their own exam list this way');
    }
    const exams = await this.repo.listExamsForTenant(true);
    const withAttempts = await Promise.all(
      exams.map(async (exam) => ({
        ...exam,
        myAttempt: await this.repo.findAttemptByExamAndLearner(exam.id, user.userId)
      }))
    );
    return withAttempts;
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

  /**
   * The staff counterpart to getAttemptQuestions — a real gap this
   * closes: before this, there was no way for a teacher to see what a
   * student actually wrote for a short-answer/essay question, since
   * the only endpoint returning attempt questions was strictly
   * learner-only. Unlike the learner-facing version, the answer key
   * (correctOptionId) is kept, not stripped — a grader needs to see
   * at a glance which MCQs were auto-marked right or wrong, alongside
   * the free-text ones they still need to score themselves.
   */
  async getAttemptForGrading(
    user: AuthenticatedUser,
    attemptId: string
  ): Promise<{ attempt: ExamAttempt & { learnerName: string | null }; questions: Question[] }> {
    this.requireStaff(user);
    const attempt = await this.repo.findAttemptWithLearnerName(attemptId);
    if (!attempt) throw new NotFoundException('Attempt not found');
    const questions = await this.repo.findQuestionsByIds(attempt.questionIds);
    return { attempt, questions };
  }

  countPendingGradingForCourse(courseId: string): Promise<number> {
    return this.repo.countPendingGradingForCourse(courseId);
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

  async listAttemptsForExam(
    user: AuthenticatedUser,
    examId: string
  ): Promise<Array<ExamAttempt & { learnerName: string | null }>> {
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

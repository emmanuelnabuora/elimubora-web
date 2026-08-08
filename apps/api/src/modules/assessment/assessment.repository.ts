import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { AuditService } from '../../core/audit/audit.service';
import { DatabaseService } from '../../core/database/database.service';
import { OutboxService } from '../../core/outbox/outbox.service';
import type {
  Certificate,
  Exam,
  ExamAttempt,
  Question,
  QuestionBank,
  QuestionOption,
  QuestionType
} from './assessment.types';

interface BankRow {
  id: string;
  title: string;
  subject: string;
  grade_level: string;
  created_by: string;
}
const toBank = (r: BankRow): QuestionBank => ({
  id: r.id,
  title: r.title,
  subject: r.subject,
  gradeLevel: r.grade_level,
  createdBy: r.created_by
});

interface QuestionRow {
  id: string;
  bank_id: string;
  question_type: QuestionType;
  prompt: string;
  options: QuestionOption[] | null;
  correct_option_id: string | null;
  marks: string;
  competency_ids: string[];
  ai_generated: boolean;
  review_status: Question['reviewStatus'];
}
const toQuestion = (r: QuestionRow): Question => ({
  id: r.id,
  bankId: r.bank_id,
  questionType: r.question_type,
  prompt: r.prompt,
  options: r.options,
  correctOptionId: r.correct_option_id,
  marks: r.marks,
  competencyIds: r.competency_ids,
  aiGenerated: r.ai_generated,
  reviewStatus: r.review_status
});

interface ExamRow {
  id: string;
  course_id: string;
  question_bank_id: string;
  title: string;
  duration_minutes: number;
  question_count: number;
  status: Exam['status'];
  created_by: string;
}
const toExam = (r: ExamRow): Exam => ({
  id: r.id,
  courseId: r.course_id,
  questionBankId: r.question_bank_id,
  title: r.title,
  durationMinutes: r.duration_minutes,
  questionCount: r.question_count,
  status: r.status,
  createdBy: r.created_by
});

interface AttemptRow {
  id: string;
  exam_id: string;
  learner_id: string;
  question_ids: string[];
  answers: Record<string, string>;
  status: ExamAttempt['status'];
  started_at: Date;
  submitted_at: Date | null;
  auto_score: string;
  manual_score: string;
  final_score: string;
  graded_by: string | null;
  graded_at: Date | null;
}
const toAttempt = (r: AttemptRow): ExamAttempt => ({
  id: r.id,
  examId: r.exam_id,
  learnerId: r.learner_id,
  questionIds: r.question_ids,
  answers: r.answers,
  status: r.status,
  startedAt: r.started_at.toISOString(),
  submittedAt: r.submitted_at ? r.submitted_at.toISOString() : null,
  autoScore: r.auto_score,
  manualScore: r.manual_score,
  finalScore: r.final_score,
  gradedBy: r.graded_by,
  gradedAt: r.graded_at ? r.graded_at.toISOString() : null
});

interface CertificateRow {
  id: string;
  student_id: string;
  title: string;
  certificate_number: string;
  awarded_by: string;
  issued_at: Date;
}
const toCertificate = (r: CertificateRow): Certificate => ({
  id: r.id,
  studentId: r.student_id,
  title: r.title,
  certificateNumber: r.certificate_number,
  awardedBy: r.awarded_by,
  issuedAt: r.issued_at.toISOString()
});

@Injectable()
export class AssessmentRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService
  ) {}

  // ---------------- question banks & questions ----------------

  async createQuestionBank(input: {
    title: string;
    subject: string;
    gradeLevel: string;
    createdBy: string;
  }): Promise<QuestionBank> {
    return this.db.withTenantTransaction(async (client) => {
      const id = randomUUID();
      const { rows } = await client.query<BankRow>(
        `INSERT INTO assessment.question_banks (id, tenant_id, title, subject, grade_level, created_by)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4, $5)
         RETURNING *`,
        [id, input.title, input.subject, input.gradeLevel, input.createdBy]
      );
      await this.audit.record(client, {
        action: 'question_bank.created',
        entityType: 'question_bank',
        entityId: id,
        after: { title: input.title }
      });
      return toBank(rows[0]!);
    });
  }

  async findQuestionBank(id: string): Promise<QuestionBank | null> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<BankRow>(
        `SELECT * FROM assessment.question_banks
          WHERE id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL`,
        [id]
      );
      return rows[0] ? toBank(rows[0]) : null;
    });
  }

  /** Every question bank in the tenant -- there was no way for a teacher to discover which banks already exist without this. */
  async listQuestionBanksForTenant(): Promise<QuestionBank[]> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<BankRow>(
        `SELECT * FROM assessment.question_banks
          WHERE tenant_id = core.current_tenant_id() AND deleted_at IS NULL
          ORDER BY title`
      );
      return rows.map(toBank);
    });
  }

  async createQuestion(input: {
    bankId: string;
    questionType: QuestionType;
    prompt: string;
    options?: QuestionOption[];
    correctOptionId?: string;
    marks: number;
    competencyIds: string[];
    aiGenerated?: boolean;
  }): Promise<Question> {
    return this.db.withTenantTransaction(async (client) => {
      const id = randomUUID();
      const aiGenerated = input.aiGenerated ?? false;
      const { rows } = await client.query<QuestionRow>(
        `INSERT INTO assessment.questions
           (id, tenant_id, bank_id, question_type, prompt, options, correct_option_id,
            marks, competency_ids, ai_generated, review_status)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          id,
          input.bankId,
          input.questionType,
          input.prompt,
          input.options ? JSON.stringify(input.options) : null,
          input.correctOptionId ?? null,
          input.marks,
          input.competencyIds,
          aiGenerated,
          // AI-drafted questions start 'pending' — structurally unselectable
          // for a real exam (see drawRandomQuestionIds / countQuestionsInBank)
          // until a teacher explicitly approves them.
          aiGenerated ? 'pending' : 'approved'
        ]
      );
      await this.audit.record(client, {
        action: 'question.created',
        entityType: 'question',
        entityId: id,
        after: { bankId: input.bankId, questionType: input.questionType, aiGenerated }
      });
      return toQuestion(rows[0]!);
    });
  }

  async reviewQuestion(
    id: string,
    status: 'approved' | 'rejected'
  ): Promise<Question | null> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<QuestionRow>(
        `UPDATE assessment.questions SET review_status = $2
          WHERE id = $1 AND tenant_id = core.current_tenant_id()
            AND ai_generated = true AND review_status = 'pending'
          RETURNING *`,
        [id, status]
      );
      if (!rows[0]) return null;
      await this.audit.record(client, {
        action: 'question.reviewed',
        entityType: 'question',
        entityId: id,
        after: { reviewStatus: status }
      });
      return toQuestion(rows[0]);
    });
  }

  /** Only APPROVED questions count — a bank padded with unreviewed AI
   *  drafts must not let an exam creation check pass on their strength. */
  async countQuestionsInBank(bankId: string): Promise<number> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{ n: string }>(
        `SELECT count(*)::int AS n FROM assessment.questions
          WHERE bank_id = $1 AND tenant_id = core.current_tenant_id()
            AND deleted_at IS NULL AND review_status = 'approved'`,
        [bankId]
      );
      return Number(rows[0]?.n ?? 0);
    });
  }

  async findQuestionsByIds(ids: string[]): Promise<Question[]> {
    if (ids.length === 0) return [];
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<QuestionRow>(
        `SELECT * FROM assessment.questions
          WHERE id = ANY($1::uuid[]) AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL`,
        [ids]
      );
      return rows.map(toQuestion);
    });
  }

  /** Every question in a bank, including ones still pending AI-draft review -- a teacher managing a bank needs to see both, not just the ones already eligible for an exam draw. */
  async listQuestionsForBank(bankId: string): Promise<Question[]> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<QuestionRow>(
        `SELECT * FROM assessment.questions
          WHERE bank_id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL
          ORDER BY created_at`,
        [bankId]
      );
      return rows.map(toQuestion);
    });
  }

  // ---------------- exams ----------------

  async createExam(input: {
    courseId: string;
    questionBankId: string;
    title: string;
    durationMinutes: number;
    questionCount: number;
    createdBy: string;
  }): Promise<Exam> {
    return this.db.withTenantTransaction(async (client) => {
      const id = randomUUID();
      const { rows } = await client.query<ExamRow>(
        `INSERT INTO assessment.exams
           (id, tenant_id, course_id, question_bank_id, title, duration_minutes, question_count, created_by)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          id,
          input.courseId,
          input.questionBankId,
          input.title,
          input.durationMinutes,
          input.questionCount,
          input.createdBy
        ]
      );
      await this.audit.record(client, {
        action: 'exam.created',
        entityType: 'exam',
        entityId: id,
        after: { title: input.title, questionCount: input.questionCount }
      });
      return toExam(rows[0]!);
    });
  }

  async findExam(id: string): Promise<Exam | null> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<ExamRow>(
        `SELECT * FROM assessment.exams
          WHERE id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL`,
        [id]
      );
      return rows[0] ? toExam(rows[0]) : null;
    });
  }

  /**
   * Every exam in the tenant, for staff managing them, or only
   * published ones for a learner deciding what to attempt --
   * mirroring the same coarse-grained, tenant-wide (not
   * course-enrollment-scoped) authorization already documented and
   * accepted in AssessmentService.startAttempt, rather than
   * introducing a different visibility rule here that the rest of
   * this module doesn't have.
   */
  async listExamsForTenant(onlyPublished: boolean): Promise<Exam[]> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<ExamRow>(
        onlyPublished
          ? `SELECT * FROM assessment.exams
              WHERE tenant_id = core.current_tenant_id() AND deleted_at IS NULL AND status = 'published'
              ORDER BY created_at DESC`
          : `SELECT * FROM assessment.exams
              WHERE tenant_id = core.current_tenant_id() AND deleted_at IS NULL
              ORDER BY created_at DESC`
      );
      return rows.map(toExam);
    });
  }

  async updateExamStatus(id: string, status: Exam['status']): Promise<Exam | null> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<ExamRow>(
        `UPDATE assessment.exams SET status = $2
          WHERE id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL
          RETURNING *`,
        [id, status]
      );
      if (!rows[0]) return null;
      await this.audit.record(client, {
        action: 'exam.status_changed',
        entityType: 'exam',
        entityId: id,
        after: { status }
      });
      return toExam(rows[0]);
    });
  }

  /**
   * Draws `questionCount` random question ids via Postgres's own
   * ORDER BY random() — randomization happens in the database, not by
   * fetching everything and shuffling in Node. THE safety gate: only
   * review_status = 'approved' questions are eligible, so an
   * AI-drafted question sitting at 'pending' is structurally
   * impossible to draw into a real attempt, regardless of any other
   * check (or bug) elsewhere in the call path.
   */
  private async drawRandomQuestionIds(
    client: PoolClient,
    bankId: string,
    count: number
  ): Promise<string[]> {
    const { rows } = await client.query<{ id: string }>(
      `SELECT id FROM assessment.questions
        WHERE bank_id = $1 AND tenant_id = core.current_tenant_id()
          AND deleted_at IS NULL AND review_status = 'approved'
        ORDER BY random()
        LIMIT $2`,
      [bankId, count]
    );
    return rows.map((r) => r.id);
  }

  /**
   * Starts an attempt: draws and FREEZES the random question set on
   * the attempt row. Grading and review always reference this frozen
   * list — later edits to the question bank never retroactively
   * change what a learner was actually examined on.
   */
  async startAttempt(input: {
    examId: string;
    learnerId: string;
    questionCount: number;
    bankId: string;
  }): Promise<ExamAttempt> {
    return this.db.withTenantTransaction(async (client) => {
      const existing = await client.query(
        `SELECT 1 FROM assessment.exam_attempts WHERE exam_id = $1 AND learner_id = $2`,
        [input.examId, input.learnerId]
      );
      if ((existing.rowCount ?? 0) > 0) {
        throw new ConflictException('An attempt for this exam already exists for this learner');
      }
      const questionIds = await this.drawRandomQuestionIds(client, input.bankId, input.questionCount);
      const id = randomUUID();
      const { rows } = await client.query<AttemptRow>(
        `INSERT INTO assessment.exam_attempts (id, tenant_id, exam_id, learner_id, question_ids)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4)
         RETURNING *`,
        [id, input.examId, input.learnerId, questionIds]
      );
      await this.audit.record(client, {
        action: 'exam_attempt.started',
        entityType: 'exam_attempt',
        entityId: id,
        after: { examId: input.examId, questionCount: questionIds.length }
      });
      return toAttempt(rows[0]!);
    });
  }

  async findAttempt(id: string): Promise<ExamAttempt | null> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<AttemptRow>(
        `SELECT * FROM assessment.exam_attempts WHERE id = $1 AND tenant_id = core.current_tenant_id()`,
        [id]
      );
      return rows[0] ? toAttempt(rows[0]) : null;
    });
  }

  async findAttemptByExamAndLearner(examId: string, learnerId: string): Promise<ExamAttempt | null> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<AttemptRow>(
        `SELECT * FROM assessment.exam_attempts
          WHERE exam_id = $1 AND learner_id = $2 AND tenant_id = core.current_tenant_id()`,
        [examId, learnerId]
      );
      return rows[0] ? toAttempt(rows[0]) : null;
    });
  }

  /**
   * Every attempt on this exam, enriched with the learner's name --
   * a teacher grading needs to know who they're grading, not just a
   * bare learner UUID. Safe to JOIN directly here, unlike the
   * cross-tenant transfers case: every learner attempting an exam is
   * necessarily a member of this same tenant already (exams are
   * tenant-scoped), so there's no RLS boundary being crossed the way
   * there is for a student who hasn't yet joined a receiving school.
   */
  async listAttemptsForExam(examId: string): Promise<Array<ExamAttempt & { learnerName: string | null }>> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<AttemptRow & { learner_name: string | null }>(
        `SELECT ea.*, u.full_name AS learner_name
           FROM assessment.exam_attempts ea
           LEFT JOIN core.users u ON u.id = ea.learner_id
          WHERE ea.exam_id = $1 AND ea.tenant_id = core.current_tenant_id()
          ORDER BY ea.started_at`,
        [examId]
      );
      return rows.map((r) => ({ ...toAttempt(r), learnerName: r.learner_name }));
    });
  }

  /**
   * Submits answers and auto-grades every MCQ immediately by comparing
   * against correct_option_id — the only place that ever reads the
   * answer key. Short-answer/essay marks start at zero and wait for a
   * human grader.
   */
  async submitAttempt(
    attemptId: string,
    answers: Record<string, string>
  ): Promise<{ attempt: ExamAttempt; needsManualGrading: boolean }> {
    return this.db.withTenantTransaction(async (client) => {
      const current = await client.query<AttemptRow>(
        `SELECT * FROM assessment.exam_attempts
          WHERE id = $1 AND tenant_id = core.current_tenant_id() AND status = 'in_progress'`,
        [attemptId]
      );
      const attemptRow = current.rows[0];
      if (!attemptRow) throw new NotFoundException('No in-progress attempt found');

      const questions = await client.query<QuestionRow>(
        `SELECT * FROM assessment.questions WHERE id = ANY($1::uuid[])`,
        [attemptRow.question_ids]
      );
      let autoScore = 0;
      let hasNonMcq = false;
      for (const q of questions.rows) {
        if (q.question_type === 'mcq') {
          if (answers[q.id] === q.correct_option_id) {
            autoScore += Number(q.marks);
          }
        } else {
          hasNonMcq = true;
        }
      }

      const { rows } = await client.query<AttemptRow>(
        `UPDATE assessment.exam_attempts
            SET answers = $2::jsonb, status = 'submitted', submitted_at = now(), auto_score = $3
          WHERE id = $1
          RETURNING *`,
        [attemptId, JSON.stringify(answers), autoScore]
      );
      await this.audit.record(client, {
        action: 'exam_attempt.submitted',
        entityType: 'exam_attempt',
        entityId: attemptId,
        after: { autoScore }
      });
      await this.outbox.append(client, {
        aggregateType: 'exam_attempt',
        aggregateId: attemptId,
        eventType: 'exam_attempt.submitted.v1',
        payload: { attemptId, examId: attemptRow.exam_id, learnerId: attemptRow.learner_id }
      });
      return { attempt: toAttempt(rows[0]!), needsManualGrading: hasNonMcq };
    });
  }

  async gradeAttempt(
    attemptId: string,
    manualScore: number,
    gradedBy: string
  ): Promise<ExamAttempt | null> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<AttemptRow>(
        `UPDATE assessment.exam_attempts
            SET manual_score = $2, status = 'graded', graded_by = $3, graded_at = now()
          WHERE id = $1 AND tenant_id = core.current_tenant_id() AND status = 'submitted'
          RETURNING *`,
        [attemptId, manualScore, gradedBy]
      );
      if (!rows[0]) return null;
      await this.audit.record(client, {
        action: 'exam_attempt.graded',
        entityType: 'exam_attempt',
        entityId: attemptId,
        after: { manualScore }
      });
      return toAttempt(rows[0]);
    });
  }

  // ---------------- certificates ----------------

  async issueCertificate(input: {
    studentId: string;
    title: string;
    awardedBy: string;
  }): Promise<Certificate> {
    return this.db.withTenantTransaction(async (client) => {
      const id = randomUUID();
      const certificateNumber = `CERT-${new Date().getFullYear()}-${randomUUID()
        .slice(0, 8)
        .toUpperCase()}`;
      const { rows } = await client.query<CertificateRow>(
        `INSERT INTO assessment.certificates
           (id, tenant_id, student_id, title, certificate_number, awarded_by)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4, $5)
         RETURNING *`,
        [id, input.studentId, input.title, certificateNumber, input.awardedBy]
      );
      await this.audit.record(client, {
        action: 'certificate.issued',
        entityType: 'certificate',
        entityId: id,
        after: { studentId: input.studentId, title: input.title }
      });
      return toCertificate(rows[0]!);
    });
  }

  async listCertificatesForStudent(studentId: string): Promise<Certificate[]> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<CertificateRow>(
        `SELECT * FROM assessment.certificates
          WHERE student_id = $1 AND tenant_id = core.current_tenant_id()
          ORDER BY issued_at DESC`,
        [studentId]
      );
      return rows.map(toCertificate);
    });
  }
}

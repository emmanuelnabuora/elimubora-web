import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { AuditService } from '../../core/audit/audit.service';
import { DatabaseService } from '../../core/database/database.service';
import { OutboxService } from '../../core/outbox/outbox.service';
import type {
  Assignment,
  Competency,
  Course,
  CourseModuleRecord,
  Enrollment,
  Lesson,
  Submission
} from './learning.types';

interface CourseRow {
  id: string;
  title: string;
  description: string | null;
  learning_area: string;
  grade_level: string;
  status: 'draft' | 'published' | 'archived';
  created_by: string;
  row_version: string;
  created_at: Date;
  updated_at: Date;
}
const toCourse = (r: CourseRow): Course => ({
  id: r.id,
  title: r.title,
  description: r.description,
  learningArea: r.learning_area,
  gradeLevel: r.grade_level,
  status: r.status,
  createdBy: r.created_by,
  rowVersion: r.row_version,
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString()
});

interface ModuleRow {
  id: string;
  course_id: string;
  title: string;
  position: number;
  row_version: string;
}
const toModule = (r: ModuleRow): CourseModuleRecord => ({
  id: r.id,
  courseId: r.course_id,
  title: r.title,
  position: r.position,
  rowVersion: r.row_version
});

interface LessonRow {
  id: string;
  module_id: string;
  title: string;
  position: number;
  content: Record<string, unknown>;
  row_version: string;
}
const toLesson = (r: LessonRow): Lesson => ({
  id: r.id,
  moduleId: r.module_id,
  title: r.title,
  position: r.position,
  content: r.content,
  rowVersion: r.row_version
});

interface AssignmentRow {
  id: string;
  course_id: string;
  title: string;
  instructions: string | null;
  due_at: Date | null;
  max_score: string;
  rubric: Record<string, unknown> | null;
  competency_ids: string[];
  row_version: string;
}
const toAssignment = (r: AssignmentRow): Assignment => ({
  id: r.id,
  courseId: r.course_id,
  title: r.title,
  instructions: r.instructions,
  dueAt: r.due_at ? r.due_at.toISOString() : null,
  maxScore: r.max_score,
  rubric: r.rubric,
  competencyIds: r.competency_ids,
  rowVersion: r.row_version
});

interface SubmissionRow {
  id: string;
  assignment_id: string;
  learner_id: string;
  content: Record<string, unknown>;
  status: 'submitted' | 'graded' | 'returned';
  submitted_at: Date;
  score: string | null;
  rubric_levels: Record<string, string> | null;
  feedback: string | null;
  graded_by: string | null;
  graded_at: Date | null;
  row_version: string;
}
const toSubmission = (r: SubmissionRow): Submission => ({
  id: r.id,
  assignmentId: r.assignment_id,
  learnerId: r.learner_id,
  content: r.content,
  status: r.status,
  submittedAt: r.submitted_at.toISOString(),
  score: r.score,
  rubricLevels: r.rubric_levels as Submission['rubricLevels'],
  feedback: r.feedback,
  gradedBy: r.graded_by,
  gradedAt: r.graded_at ? r.graded_at.toISOString() : null,
  rowVersion: r.row_version
});

/**
 * All learning-domain SQL. Writes go through DatabaseService's
 * tenant-scoped transactions; audit entries are written in the SAME
 * transaction as the state change (never a separate round trip), and
 * cross-module-relevant changes append an outbox event. change_log
 * rows (the sync pull feed) are produced by database triggers, not
 * application code — a module cannot forget to sync a write.
 */
@Injectable()
export class LearningRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService
  ) {}

  // ---------------- courses ----------------

  async createCourse(input: {
    title: string;
    description?: string;
    learningArea: string;
    gradeLevel: string;
    createdBy: string;
  }): Promise<Course> {
    return this.db.withTenantTransaction(async (client) => {
      const id = randomUUID();
      const { rows } = await client.query<CourseRow>(
        `INSERT INTO learning.courses
           (id, tenant_id, title, description, learning_area, grade_level, created_by)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4, $5, $6)
         RETURNING *`,
        [id, input.title, input.description ?? null, input.learningArea, input.gradeLevel, input.createdBy]
      );
      await this.audit.record(client, {
        action: 'course.created',
        entityType: 'course',
        entityId: id,
        after: { title: input.title, gradeLevel: input.gradeLevel }
      });
      return toCourse(rows[0]!);
    });
  }

  async findCourse(id: string): Promise<Course | null> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<CourseRow>(
        `SELECT * FROM learning.courses
          WHERE id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL`,
        [id]
      );
      return rows[0] ? toCourse(rows[0]) : null;
    });
  }

  async listCourses(filter: { gradeLevel?: string; status?: string }): Promise<Course[]> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<CourseRow>(
        `SELECT * FROM learning.courses
          WHERE tenant_id = core.current_tenant_id() AND deleted_at IS NULL
            AND ($1::text IS NULL OR grade_level = $1)
            AND ($2::text IS NULL OR status = $2)
          ORDER BY created_at DESC`,
        [filter.gradeLevel ?? null, filter.status ?? null]
      );
      return rows.map(toCourse);
    });
  }

  async updateCourse(
    id: string,
    patch: { title?: string; description?: string; status?: string }
  ): Promise<Course | null> {
    return this.db.withTenantTransaction(async (client) => {
      const before = await client.query<CourseRow>(
        `SELECT * FROM learning.courses
          WHERE id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL`,
        [id]
      );
      if (!before.rows[0]) return null;
      const { rows } = await client.query<CourseRow>(
        `UPDATE learning.courses
            SET title = COALESCE($2, title),
                description = COALESCE($3, description),
                status = COALESCE($4, status)
          WHERE id = $1
          RETURNING *`,
        [id, patch.title ?? null, patch.description ?? null, patch.status ?? null]
      );
      await this.audit.record(client, {
        action: 'course.updated',
        entityType: 'course',
        entityId: id,
        before: { status: before.rows[0]!.status },
        after: patch
      });
      if (patch.status === 'published') {
        await this.outbox.append(client, {
          aggregateType: 'course',
          aggregateId: id,
          eventType: 'course.published.v1',
          payload: { courseId: id }
        });
      }
      return toCourse(rows[0]!);
    });
  }

  // ---------------- modules & lessons ----------------

  async createModule(courseId: string, title: string, position: number): Promise<CourseModuleRecord> {
    return this.db.withTenantTransaction(async (client) => {
      const id = randomUUID();
      const { rows } = await client.query<ModuleRow>(
        `INSERT INTO learning.course_modules (id, tenant_id, course_id, title, position)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4)
         RETURNING *`,
        [id, courseId, title, position]
      );
      await this.audit.record(client, {
        action: 'course_module.created',
        entityType: 'course_module',
        entityId: id,
        after: { courseId, title }
      });
      return toModule(rows[0]!);
    });
  }

  async listModules(courseId: string): Promise<CourseModuleRecord[]> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<ModuleRow>(
        `SELECT * FROM learning.course_modules
          WHERE course_id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL
          ORDER BY position`,
        [courseId]
      );
      return rows.map(toModule);
    });
  }

  async createLesson(
    moduleId: string,
    title: string,
    position: number,
    content: Record<string, unknown>
  ): Promise<Lesson> {
    return this.db.withTenantTransaction(async (client) => {
      const id = randomUUID();
      const { rows } = await client.query<LessonRow>(
        `INSERT INTO learning.lessons (id, tenant_id, module_id, title, position, content)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4, $5::jsonb)
         RETURNING *`,
        [id, moduleId, title, position, JSON.stringify(content)]
      );
      await this.audit.record(client, {
        action: 'lesson.created',
        entityType: 'lesson',
        entityId: id,
        after: { moduleId, title }
      });
      return toLesson(rows[0]!);
    });
  }

  async listLessons(moduleId: string): Promise<Lesson[]> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<LessonRow>(
        `SELECT * FROM learning.lessons
          WHERE module_id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL
          ORDER BY position`,
        [moduleId]
      );
      return rows.map(toLesson);
    });
  }

  // ---------------- competencies ----------------

  async findCompetenciesByIds(ids: string[]): Promise<Competency[]> {
    if (ids.length === 0) return [];
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{
        id: string;
        code: string;
        title: string;
        strand: string;
        sub_strand: string | null;
      }>(
        `SELECT id, code, title, strand, sub_strand FROM learning.competencies
          WHERE id = ANY($1::uuid[]) AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL`,
        [ids]
      );
      return rows.map((r) => ({
        id: r.id,
        code: r.code,
        title: r.title,
        strand: r.strand,
        subStrand: r.sub_strand
      }));
    });
  }

  // ---------------- assignments ----------------

  async createAssignment(input: {
    courseId: string;
    title: string;
    instructions?: string;
    dueAt?: string;
    maxScore: number;
    rubric?: Record<string, unknown>;
    competencyIds: string[];
  }): Promise<Assignment> {
    return this.db.withTenantTransaction(async (client) => {
      const id = randomUUID();
      const { rows } = await client.query<AssignmentRow>(
        `INSERT INTO learning.assignments
           (id, tenant_id, course_id, title, instructions, due_at, max_score, rubric, competency_ids)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4, $5, $6, $7::jsonb, $8::uuid[])
         RETURNING *`,
        [
          id,
          input.courseId,
          input.title,
          input.instructions ?? null,
          input.dueAt ?? null,
          input.maxScore,
          input.rubric ? JSON.stringify(input.rubric) : null,
          input.competencyIds
        ]
      );
      await this.audit.record(client, {
        action: 'assignment.created',
        entityType: 'assignment',
        entityId: id,
        after: { courseId: input.courseId, title: input.title }
      });
      await this.outbox.append(client, {
        aggregateType: 'assignment',
        aggregateId: id,
        eventType: 'assignment.created.v1',
        payload: { assignmentId: id, courseId: input.courseId, dueAt: input.dueAt ?? null }
      });
      return toAssignment(rows[0]!);
    });
  }

  async findAssignment(id: string): Promise<Assignment | null> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<AssignmentRow>(
        `SELECT * FROM learning.assignments
          WHERE id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL`,
        [id]
      );
      return rows[0] ? toAssignment(rows[0]) : null;
    });
  }

  async listAssignmentsForCourse(courseId: string): Promise<Assignment[]> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<AssignmentRow>(
        `SELECT * FROM learning.assignments
          WHERE course_id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL
          ORDER BY due_at NULLS LAST, created_at`,
        [courseId]
      );
      return rows.map(toAssignment);
    });
  }

  // ---------------- enrollments ----------------

  async enroll(courseId: string, userId: string, courseRole: 'learner' | 'teacher'): Promise<Enrollment> {
    return this.db.withTenantTransaction(async (client) => {
      const id = randomUUID();
      const { rows } = await client.query<{
        id: string;
        course_id: string;
        user_id: string;
        course_role: 'learner' | 'teacher';
      }>(
        `INSERT INTO learning.enrollments (id, tenant_id, course_id, user_id, course_role)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4)
         ON CONFLICT (course_id, user_id)
         DO UPDATE SET course_role = EXCLUDED.course_role, deleted_at = NULL
         RETURNING id, course_id, user_id, course_role`,
        [id, courseId, userId, courseRole]
      );
      await this.audit.record(client, {
        action: 'enrollment.created',
        entityType: 'enrollment',
        entityId: rows[0]!.id,
        after: { courseId, userId, courseRole }
      });
      return {
        id: rows[0]!.id,
        courseId: rows[0]!.course_id,
        userId: rows[0]!.user_id,
        courseRole: rows[0]!.course_role
      };
    });
  }

  async isEnrolled(courseId: string, userId: string, role?: 'learner' | 'teacher'): Promise<boolean> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT 1 FROM learning.enrollments
          WHERE course_id = $1 AND user_id = $2 AND tenant_id = core.current_tenant_id()
            AND deleted_at IS NULL AND ($3::text IS NULL OR course_role = $3)`,
        [courseId, userId, role ?? null]
      );
      return rows.length > 0;
    });
  }

  async listRosterForCourse(courseId: string): Promise<Enrollment[]> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{
        id: string;
        course_id: string;
        user_id: string;
        course_role: 'learner' | 'teacher';
      }>(
        `SELECT id, course_id, user_id, course_role FROM learning.enrollments
          WHERE course_id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL`,
        [courseId]
      );
      return rows.map((r) => ({
        id: r.id,
        courseId: r.course_id,
        userId: r.user_id,
        courseRole: r.course_role
      }));
    });
  }

  // ---------------- submissions ----------------

  /** Used by both the synchronous online endpoint and the sync mutation handler. */
  async upsertSubmission(
    client: PoolClient,
    input: { id: string; assignmentId: string; learnerId: string; content: Record<string, unknown> }
  ): Promise<{ submission: Submission; created: boolean }> {
    const { rows } = await client.query<SubmissionRow & { xmax: string }>(
      `INSERT INTO learning.submissions (id, tenant_id, assignment_id, learner_id, content)
       VALUES ($1, core.current_tenant_id(), $2, $3, $4::jsonb)
       ON CONFLICT (assignment_id, learner_id) DO NOTHING
       RETURNING *, xmax::text AS xmax`,
      [input.id, input.assignmentId, input.learnerId, JSON.stringify(input.content)]
    );
    if (rows[0]) {
      return { submission: toSubmission(rows[0]), created: true };
    }
    // Already exists for this (assignment, learner) pair — idempotent no-op,
    // return the existing row rather than erroring (a learner may submit once).
    const existing = await client.query<SubmissionRow>(
      `SELECT * FROM learning.submissions
        WHERE assignment_id = $1 AND learner_id = $2 AND tenant_id = core.current_tenant_id()`,
      [input.assignmentId, input.learnerId]
    );
    return { submission: toSubmission(existing.rows[0]!), created: false };
  }

  /**
   * Synchronous/online counterpart to the sync mutation handler's use
   * of upsertSubmission — same write path, own transaction, audit and
   * outbox recorded identically so "online" and "synced from offline"
   * are indistinguishable after the fact.
   */
  async upsertSubmissionForOnlineSubmit(
    assignmentId: string,
    learnerId: string,
    content: Record<string, unknown>
  ): Promise<Submission> {
    return this.db.withTenantTransaction(async (client) => {
      const { submission, created } = await this.upsertSubmission(client, {
        id: randomUUID(),
        assignmentId,
        learnerId,
        content
      });
      if (created) {
        await this.audit.record(client, {
          action: 'submission.created',
          entityType: 'submission',
          entityId: submission.id,
          after: { assignmentId }
        });
        await this.outbox.append(client, {
          aggregateType: 'submission',
          aggregateId: submission.id,
          eventType: 'submission.created.v1',
          payload: { submissionId: submission.id, assignmentId, learnerId }
        });
      }
      return submission;
    });
  }

  async findSubmission(assignmentId: string, learnerId: string): Promise<Submission | null> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<SubmissionRow>(
        `SELECT * FROM learning.submissions
          WHERE assignment_id = $1 AND learner_id = $2 AND tenant_id = core.current_tenant_id()`,
        [assignmentId, learnerId]
      );
      return rows[0] ? toSubmission(rows[0]) : null;
    });
  }

  async findSubmissionById(id: string): Promise<Submission | null> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<SubmissionRow>(
        `SELECT * FROM learning.submissions WHERE id = $1 AND tenant_id = core.current_tenant_id()`,
        [id]
      );
      return rows[0] ? toSubmission(rows[0]) : null;
    });
  }

  async listSubmissionsForAssignment(assignmentId: string): Promise<Submission[]> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<SubmissionRow>(
        `SELECT * FROM learning.submissions
          WHERE assignment_id = $1 AND tenant_id = core.current_tenant_id()
          ORDER BY submitted_at`,
        [assignmentId]
      );
      return rows.map(toSubmission);
    });
  }

  /** For the composition layer (Analytics) — owned here since submissions are Learning's data. */
  async countPendingGradingForCourse(courseId: string): Promise<number> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{ n: string }>(
        `SELECT count(*)::int AS n
           FROM learning.submissions s
           JOIN learning.assignments a ON a.id = s.assignment_id
          WHERE a.course_id = $1 AND s.status = 'submitted'
            AND s.tenant_id = core.current_tenant_id()`,
        [courseId]
      );
      return Number(rows[0]?.n ?? 0);
    });
  }

  /**
   * Learning analytics for one course: enrollment, submission
   * completion, and grading progress. A live aggregate, not a
   * snapshot — unlike Government Dashboard (ADR-012), this stays
   * entirely within one tenant's RLS boundary, so there is no
   * cross-tenant read to work around and no need for a refreshed
   * rollup table at ordinary school scale.
   */
  async getCourseAnalytics(courseId: string): Promise<{
    enrolledLearners: number;
    assignmentCount: number;
    submittedCount: number;
    gradedCount: number;
    averageScore: number | null;
  }> {
    return this.db.withTenantTransaction(async (client) => {
      const enrolled = await client.query<{ n: string }>(
        `SELECT count(*)::int AS n FROM learning.enrollments
          WHERE course_id = $1 AND course_role = 'learner'
            AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL`,
        [courseId]
      );
      const assignments = await client.query<{ n: string }>(
        `SELECT count(*)::int AS n FROM learning.assignments
          WHERE course_id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL`,
        [courseId]
      );
      const submissions = await client.query<{
        submitted: string;
        graded: string;
        avg_score: string | null;
      }>(
        `SELECT
           count(*) FILTER (WHERE s.status IN ('submitted', 'graded')) AS submitted,
           count(*) FILTER (WHERE s.status = 'graded') AS graded,
           avg(s.score) FILTER (WHERE s.status = 'graded') AS avg_score
           FROM learning.submissions s
           JOIN learning.assignments a ON a.id = s.assignment_id
          WHERE a.course_id = $1 AND s.tenant_id = core.current_tenant_id()`,
        [courseId]
      );
      const row = submissions.rows[0];
      return {
        enrolledLearners: Number(enrolled.rows[0]?.n ?? 0),
        assignmentCount: Number(assignments.rows[0]?.n ?? 0),
        submittedCount: Number(row?.submitted ?? 0),
        gradedCount: Number(row?.graded ?? 0),
        averageScore: row?.avg_score !== null && row?.avg_score !== undefined ? Number(row.avg_score) : null
      };
    });
  }

  /** Performance analytics for one learner: their average graded score across every course. */
  async getLearnerPerformance(learnerId: string): Promise<{
    gradedSubmissionCount: number;
    averageScore: number | null;
  }> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{ n: string; avg_score: string | null }>(
        `SELECT count(*)::int AS n, avg(score) AS avg_score
           FROM learning.submissions
          WHERE learner_id = $1 AND status = 'graded' AND tenant_id = core.current_tenant_id()`,
        [learnerId]
      );
      const row = rows[0];
      return {
        gradedSubmissionCount: Number(row?.n ?? 0),
        averageScore: row?.avg_score !== null && row?.avg_score !== undefined ? Number(row.avg_score) : null
      };
    });
  }

  /** Grading backlog across every course a teacher teaches — Teacher Analytics. */
  async getGradingBacklogForTeacher(teacherId: string): Promise<number> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{ n: string }>(
        `SELECT count(*)::int AS n
           FROM learning.submissions s
           JOIN learning.assignments a ON a.id = s.assignment_id
           JOIN learning.enrollments e
             ON e.course_id = a.course_id AND e.user_id = $1 AND e.course_role = 'teacher'
              AND e.tenant_id = core.current_tenant_id() AND e.deleted_at IS NULL
          WHERE s.status = 'submitted' AND s.tenant_id = core.current_tenant_id()`,
        [teacherId]
      );
      return Number(rows[0]?.n ?? 0);
    });
  }

  /** All active learner ids in courses of a given grade level — the population Early Warning scans. */
  async listActiveLearnerIds(): Promise<string[]> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{ user_id: string }>(
        `SELECT DISTINCT user_id FROM learning.enrollments
          WHERE course_role = 'learner' AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL`
      );
      return rows.map((r) => r.user_id);
    });
  }

  /** Grading is server-authoritative — never accepted via sync mutation. */
  async gradeSubmission(
    submissionId: string,
    grade: {
      score: number;
      rubricLevels?: Record<string, string>;
      feedback?: string;
      gradedBy: string;
    }
  ): Promise<Submission | null> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<SubmissionRow>(
        `UPDATE learning.submissions
            SET score = $2, rubric_levels = $3::jsonb, feedback = $4,
                graded_by = $5, graded_at = now(), status = 'graded'
          WHERE id = $1 AND tenant_id = core.current_tenant_id()
          RETURNING *`,
        [
          submissionId,
          grade.score,
          grade.rubricLevels ? JSON.stringify(grade.rubricLevels) : null,
          grade.feedback ?? null,
          grade.gradedBy
        ]
      );
      if (!rows[0]) return null;
      await this.audit.record(client, {
        action: 'submission.graded',
        entityType: 'submission',
        entityId: submissionId,
        after: { score: grade.score }
      });
      await this.outbox.append(client, {
        aggregateType: 'submission',
        aggregateId: submissionId,
        eventType: 'submission.graded.v1',
        payload: {
          submissionId,
          assignmentId: rows[0].assignment_id,
          learnerId: rows[0].learner_id,
          score: grade.score
        }
      });
      return toSubmission(rows[0]);
    });
  }
}

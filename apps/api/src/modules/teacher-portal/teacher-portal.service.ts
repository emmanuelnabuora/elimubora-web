import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { AiInteractionLogService } from '../../core/ai/ai-interaction-log.service';
import { AI_PROVIDER, type AiProvider } from '../../core/ai/ai-provider.port';
import type { CreateLessonPlanDto, MarkAttendanceDto } from './teacher-portal.dto';
import { TeacherPortalRepository } from './teacher-portal.repository';
import type { AttendanceRecord, LessonPlan } from './teacher-portal.types';

const STAFF_ROLES = new Set(['teacher', 'school_admin', 'principal', 'platform_admin']);
const ADMIN_ROLES = new Set(['school_admin', 'principal', 'platform_admin']);

/**
 * Authorization here is coarse-grained (any staff role may mark
 * attendance or plan lessons for the tenant) rather than verifying a
 * specific teacher-to-class-stream assignment. That finer check
 * depends on a timetable/teaching-assignment record, which is Sprint
 * 8 (School Administration) scope — a documented simplification, not
 * an oversight.
 */
@Injectable()
export class TeacherPortalService {
  constructor(
    private readonly repo: TeacherPortalRepository,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
    private readonly aiLog: AiInteractionLogService
  ) {}

  private requireStaff(user: AuthenticatedUser): void {
    if (!STAFF_ROLES.has(user.role)) {
      throw new ForbiddenException('Only teaching staff can perform this action');
    }
  }

  private requireAdmin(user: AuthenticatedUser): void {
    if (!ADMIN_ROLES.has(user.role)) {
      throw new ForbiddenException('Only school administration can perform this action');
    }
  }

  async markAttendance(user: AuthenticatedUser, dto: MarkAttendanceDto): Promise<AttendanceRecord> {
    this.requireStaff(user);
    return this.repo.markAttendance({ ...dto, recordedBy: user.userId });
  }

  /**
   * Class-wide attendance is a roster of every student in that class
   * on a given day — staff-only. Unlike listAttendanceForLearner
   * below, there's no sensible "self" case here: no individual
   * student or guardian has a legitimate reason to see everyone
   * else's attendance for the day, only their own.
   */
  listAttendanceForClass(user: AuthenticatedUser, classStreamId: string, date: string): Promise<AttendanceRecord[]> {
    this.requireStaff(user);
    return this.repo.listAttendanceForClassOnDate(classStreamId, date);
  }

  /**
   * A real gap closed here: this method (and the route calling it)
   * previously had NO authorization check at all beyond being
   * authenticated — any tenant member could view any other learner's
   * attendance simply by knowing their user id. Allows staff (any
   * role, matching markAttendance's own coarse-grained staff check)
   * or the learner viewing their own record. Deliberately does NOT
   * add a guardian case here: ParentPortalController already has its
   * own, separately and correctly guarded path
   * (GET /parent-portal/children/:studentId/attendance, gated by
   * SisRepository.isGuardianOf) — duplicating that check here would
   * require this module to import SisModule, which the module-
   * boundary rule (domain modules depend on core, never on each
   * other) forbids. A guardian who isn't also staff gets a real 403
   * from this raw endpoint and should use the parent-portal one
   * instead, which they already do via the actual Parent Dashboard UI.
   */
  listAttendanceForLearner(user: AuthenticatedUser, learnerId: string): Promise<AttendanceRecord[]> {
    if (user.userId !== learnerId && !STAFF_ROLES.has(user.role)) {
      throw new ForbiddenException('You can only view your own attendance record');
    }
    return this.repo.listAttendanceForLearner(learnerId);
  }

  async createLessonPlan(user: AuthenticatedUser, dto: CreateLessonPlanDto): Promise<LessonPlan> {
    this.requireStaff(user);
    return this.repo.createLessonPlan({ ...dto, teacherId: user.userId });
  }

  /**
   * AI-assisted drafting reuses the exact same lesson_plans table and
   * draft -> submitted -> approved workflow as a manually-written
   * plan (Sprint 6) — AI is just another way to CREATE a draft, never
   * a parallel content path. The plan lands with status='draft' like
   * any other; nothing about the existing approval flow changes.
   */
  async draftLessonPlanWithAi(
    user: AuthenticatedUser,
    input: { courseId: string; weekOf: string; topic: string }
  ): Promise<LessonPlan> {
    this.requireStaff(user);
    const result = await this.ai.complete({
      feature: 'lesson_plan_draft',
      prompt: `Draft a lesson plan for the week of ${input.weekOf} on the topic: ${input.topic}`,
      context: { courseId: input.courseId }
    });
    await this.aiLog.record({
      userId: user.userId,
      feature: 'lesson_plan_draft',
      context: { courseId: input.courseId, weekOf: input.weekOf },
      promptSummary: input.topic,
      responseSummary: result.text
    });
    return this.repo.createLessonPlan({
      courseId: input.courseId,
      teacherId: user.userId,
      weekOf: input.weekOf,
      objectives: result.text,
      activities: [],
      aiGenerated: true
    });
  }

  listLessonPlans(courseId: string): Promise<LessonPlan[]> {
    return this.repo.listLessonPlansForCourse(courseId);
  }

  /**
   * draft -> submitted is the teacher's own action (submitting their
   * work for review) -- any staff role can do it. submitted ->
   * approved and submitted -> draft (sending it back for revision)
   * are admin-only: this is the actual gate that was missing before
   * -- a teacher could previously submit their own plan and then
   * immediately approve it themselves through the exact same
   * endpoint, since the old code accepted any status from any staff
   * role with no transition check at all. draft -> approved directly
   * (skipping review) is never allowed, for anyone.
   */
  async updateLessonPlanStatus(
    user: AuthenticatedUser,
    id: string,
    status: LessonPlan['status']
  ): Promise<LessonPlan> {
    this.requireStaff(user);
    let expectedCurrentStatus: LessonPlan['status'];
    if (status === 'submitted') {
      expectedCurrentStatus = 'draft';
    } else if (status === 'approved' || status === 'draft') {
      this.requireAdmin(user);
      expectedCurrentStatus = 'submitted';
    } else {
      throw new ForbiddenException('Unknown status');
    }
    const updated = await this.repo.updateLessonPlanStatus(id, status, expectedCurrentStatus);
    if (!updated) {
      throw new NotFoundException(
        'Lesson plan not found, or not in the right state for this change'
      );
    }
    return updated;
  }

  /** The admin review queue — every submitted plan across every course/teacher, awaiting approval. */
  async listSubmittedLessonPlans(
    user: AuthenticatedUser
  ): Promise<Array<LessonPlan & { courseTitle: string; teacherName: string }>> {
    this.requireAdmin(user);
    return this.repo.listLessonPlansByStatus('submitted');
  }
}


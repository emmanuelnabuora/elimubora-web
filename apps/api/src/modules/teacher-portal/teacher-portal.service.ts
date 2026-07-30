import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { AiInteractionLogService } from '../../core/ai/ai-interaction-log.service';
import { AI_PROVIDER, type AiProvider } from '../../core/ai/ai-provider.port';
import type { CreateLessonPlanDto, MarkAttendanceDto } from './teacher-portal.dto';
import { TeacherPortalRepository } from './teacher-portal.repository';
import type { AttendanceRecord, LessonPlan } from './teacher-portal.types';

const STAFF_ROLES = new Set(['teacher', 'school_admin', 'principal', 'platform_admin']);

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

  async markAttendance(user: AuthenticatedUser, dto: MarkAttendanceDto): Promise<AttendanceRecord> {
    this.requireStaff(user);
    return this.repo.markAttendance({ ...dto, recordedBy: user.userId });
  }

  listAttendanceForClass(classStreamId: string, date: string): Promise<AttendanceRecord[]> {
    return this.repo.listAttendanceForClassOnDate(classStreamId, date);
  }

  listAttendanceForLearner(learnerId: string): Promise<AttendanceRecord[]> {
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

  async updateLessonPlanStatus(
    user: AuthenticatedUser,
    id: string,
    status: LessonPlan['status']
  ): Promise<LessonPlan> {
    this.requireStaff(user);
    const updated = await this.repo.updateLessonPlanStatus(id, status);
    if (!updated) throw new NotFoundException('Lesson plan not found');
    return updated;
  }
}

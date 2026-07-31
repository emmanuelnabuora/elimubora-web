import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Query
} from '@nestjs/common';
import { CurrentUser } from '../core/auth/decorators';
import type { AuthenticatedUser } from '../core/auth/auth.types';
import { ZodValidationPipe } from '../core/http/zod-validation.pipe';
import { FinanceRepository } from '../modules/finance/finance.repository';
import { LearningRepository } from '../modules/learning/learning.repository';
import { TeacherPortalRepository } from '../modules/teacher-portal/teacher-portal.repository';
import {
  collectionSummaryQuerySchema,
  earlyWarningQuerySchema,
  type CollectionSummaryQueryDto,
  type EarlyWarningQueryDto
} from './analytics.dto';

const STAFF_ROLES = new Set(['teacher', 'school_admin', 'principal', 'platform_admin']);
const ADMIN_ROLES = new Set(['school_admin', 'principal', 'platform_admin']);

/** Early Warning thresholds — plain, explainable rules, not a model. See class doc below. */
const LOW_ATTENDANCE_THRESHOLD = 0.75;
const LOW_PERFORMANCE_THRESHOLD = 50;
/** Require at least this many recorded days before judging attendance — a handful of
 *  early-term absences shouldn't flag a learner on day three of the school year. */
const MIN_ATTENDANCE_DAYS_FOR_JUDGEMENT = 5;

/**
 * Composition layer (ADR-008): School-level analytics — the mirror
 * image of Sprint 13's Government Dashboard. Everything here stays
 * within ONE tenant's RLS boundary, so unlike Government Dashboard
 * (which needed a refreshed cross-tenant snapshot layer because RLS
 * fundamentally can't help across tenants), this is pure live read
 * composition: no new tables, no refresh step, no worker role.
 *
 * "Predictive Analytics" (the brief's term) is implemented honestly
 * as a RULE-BASED early-warning indicator — fixed, explainable
 * thresholds on attendance rate and average score — not a machine
 * learning model. This codebase has no ML infrastructure and no
 * training data; claiming otherwise would be exactly the kind of
 * dishonesty the AI Platform sandbox (ADR-011) and M-Pesa sandbox
 * (Finance) both deliberately avoided. At real school scale this
 * per-learner scan is a natural candidate to move to a
 * periodically-refreshed snapshot (the Sprint 13 pattern); at
 * ordinary school sizes a live computation is simpler and sufficient.
 */
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly learning: LearningRepository,
    private readonly teacherPortal: TeacherPortalRepository,
    private readonly finance: FinanceRepository
  ) {}

  private requireStaff(user: AuthenticatedUser): void {
    if (!STAFF_ROLES.has(user.role)) {
      throw new ForbiddenException('Analytics are restricted to teaching staff');
    }
  }

  /** Learning Analytics: enrollment, submission completion, grading progress for one course. */
  @Get('course/:courseId')
  async courseAnalytics(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId', ParseUUIDPipe) courseId: string
  ) {
    this.requireStaff(user);
    return this.learning.getCourseAnalytics(courseId);
  }

  /** Performance Analytics: one learner's average graded score across every course. */
  @Get('learner/:learnerId')
  async learnerPerformance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('learnerId', ParseUUIDPipe) learnerId: string
  ) {
    this.requireStaff(user);
    return this.learning.getLearnerPerformance(learnerId);
  }

  /** Teacher Analytics: grading backlog across every course a teacher teaches — self or admin. */
  @Get('teacher/:teacherId/grading-backlog')
  async teacherGradingBacklog(
    @CurrentUser() user: AuthenticatedUser,
    @Param('teacherId', ParseUUIDPipe) teacherId: string
  ) {
    if (user.userId !== teacherId && !ADMIN_ROLES.has(user.role)) {
      throw new ForbiddenException('You can only view your own grading backlog');
    }
    const pendingCount = await this.learning.getGradingBacklogForTeacher(teacherId);
    return { teacherId, pendingCount };
  }

  /** Financial Analytics: fee collection rate for a year (optionally one term) — admin-only. */
  @Get('finance/collection-summary')
  async collectionSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(collectionSummaryQuerySchema)) query: CollectionSummaryQueryDto
  ) {
    if (!ADMIN_ROLES.has(user.role)) {
      throw new ForbiddenException('Financial analytics are restricted to school administration');
    }
    const summary = await this.finance.getCollectionSummary(query.academicYear, query.term);
    const invoiced = Number(summary.totalInvoiced);
    const collected = Number(summary.totalCollected);
    return {
      ...summary,
      collectionRatePercent: invoiced > 0 ? Math.round((collected / invoiced) * 10_000) / 100 : null
    };
  }

  /**
   * Early Warning: every active learner whose recent attendance rate
   * or average graded score falls below a fixed, documented
   * threshold. Rule-based, not predictive — see class doc.
   */
  @Get('early-warning')
  async earlyWarning(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(earlyWarningQuerySchema)) query: EarlyWarningQueryDto
  ) {
    this.requireStaff(user);
    const learnerIds = await this.learning.listActiveLearnerIds();

    const flagged: Array<{
      learnerId: string;
      reasons: string[];
      attendanceRate: number | null;
      averageScore: number | null;
    }> = [];

    for (const learnerId of learnerIds) {
      const [attendance, performance] = await Promise.all([
        this.teacherPortal.getAttendanceRateForLearner(learnerId, query.academicYear),
        this.learning.getLearnerPerformance(learnerId)
      ]);

      const reasons: string[] = [];
      let attendanceRate: number | null = null;
      if (attendance && attendance.recordedDays >= MIN_ATTENDANCE_DAYS_FOR_JUDGEMENT) {
        attendanceRate = attendance.presentOrLateDays / attendance.recordedDays;
        if (attendanceRate < LOW_ATTENDANCE_THRESHOLD) reasons.push('low_attendance');
      }
      if (performance.averageScore !== null && performance.averageScore < LOW_PERFORMANCE_THRESHOLD) {
        reasons.push('low_performance');
      }

      if (reasons.length > 0) {
        flagged.push({
          learnerId,
          reasons,
          attendanceRate: attendanceRate !== null ? Math.round(attendanceRate * 10_000) / 100 : null,
          averageScore: performance.averageScore
        });
      }
    }
    return { academicYear: query.academicYear, flaggedCount: flagged.length, learners: flagged };
  }
}

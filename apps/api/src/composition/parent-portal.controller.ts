import { Controller, ForbiddenException, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { CurrentUser } from '../core/auth/decorators';
import type { AuthenticatedUser } from '../core/auth/auth.types';
import { CommsRepository } from '../modules/comms/comms.repository';
import { FinanceRepository } from '../modules/finance/finance.repository';
import { LearningRepository } from '../modules/learning/learning.repository';
import { SisRepository } from '../modules/sis/sis.repository';
import { TeacherPortalRepository } from '../modules/teacher-portal/teacher-portal.repository';

/**
 * Composition layer (ADR-008): Parent Portal is almost entirely read
 * aggregation over data other modules already own — attendance
 * (Teacher Portal), homework/performance (Learning), behaviour notes
 * (SIS), announcements (Comms). Every read is gated by an explicit
 * guardian-link check against SIS, never by trusting the client.
 * Messaging (parent-teacher conversations) is Sprint 12 scope; fees
 * and payments views arrive with Finance (Sprint 9).
 */
@Controller('parent-portal')
export class ParentPortalController {
  constructor(
    private readonly sis: SisRepository,
    private readonly learning: LearningRepository,
    private readonly teacherPortal: TeacherPortalRepository,
    private readonly comms: CommsRepository,
    private readonly finance: FinanceRepository
  ) {}

  @Get('children')
  listChildren(@CurrentUser() user: AuthenticatedUser) {
    return this.sis.listChildrenForGuardianUser(user.userId);
  }

  private async requireGuardianOf(user: AuthenticatedUser, studentId: string): Promise<void> {
    const isGuardian = await this.sis.isGuardianOf(user.userId, studentId);
    if (!isGuardian) {
      throw new ForbiddenException('You are not a registered guardian of this student');
    }
  }

  @Get('children/:studentId/attendance')
  async attendance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId', ParseUUIDPipe) studentId: string
  ) {
    await this.requireGuardianOf(user, studentId);
    return this.teacherPortal.listAttendanceForLearner(studentId);
  }

  @Get('children/:studentId/behaviour-notes')
  async behaviourNotes(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId', ParseUUIDPipe) studentId: string
  ) {
    await this.requireGuardianOf(user, studentId);
    return this.sis.listBehaviourNotesForStudent(studentId);
  }

  /** Fees view: every invoice for the child plus its payment history — read composition over Finance's own data. */
  @Get('children/:studentId/fees')
  async fees(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId', ParseUUIDPipe) studentId: string
  ) {
    await this.requireGuardianOf(user, studentId);
    const invoices = await this.finance.listInvoicesForStudent(studentId);
    return Promise.all(
      invoices.map(async (invoice) => ({
        ...invoice,
        payments: await this.finance.listPaymentsForInvoice(invoice.id)
      }))
    );
  }

  /**
   * Homework/performance view: every course the child is enrolled in
   * as a learner, with their submission status per assignment. A
   * straightforward composition of Learning's own data, scoped by the
   * guardian-link check rather than Learning's own enrollment check
   * (the guardian isn't enrolled — their child is).
   */
  @Get('children/:studentId/performance')
  async performance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId', ParseUUIDPipe) studentId: string
  ) {
    await this.requireGuardianOf(user, studentId);
    const courses = await this.learning.listCourses({});
    const results = [];
    for (const course of courses) {
      const enrolled = await this.learning.isEnrolled(course.id, studentId, 'learner');
      if (!enrolled) continue;
      const assignments = await this.learning.listAssignmentsForCourse(course.id);
      const withSubmissions = await Promise.all(
        assignments.map(async (a) => ({
          assignmentId: a.id,
          title: a.title,
          submission: await this.learning.findSubmission(a.id, studentId)
        }))
      );
      results.push({ courseId: course.id, title: course.title, assignments: withSubmissions });
    }
    return results;
  }

  @Get('announcements')
  async announcements(@CurrentUser() user: AuthenticatedUser) {
    const children = await this.sis.listChildrenForGuardianUser(user.userId);
    // A guardian sees whole-school announcements plus those targeted at
    // any of their children's current grade levels.
    const gradeLevels = new Set<string>();
    for (const child of children) {
      const level = await this.sis.getCurrentGradeLevel(child.studentId);
      if (level) gradeLevels.add(level);
    }
    return this.comms.listForGradeLevels([...gradeLevels]);
  }
}

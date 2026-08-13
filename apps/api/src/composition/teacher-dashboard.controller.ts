import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../core/auth/decorators';
import type { AuthenticatedUser } from '../core/auth/auth.types';
import { AssessmentRepository } from '../modules/assessment/assessment.repository';
import { LearningRepository } from '../modules/learning/learning.repository';
import { SchoolAdminRepository } from '../modules/school-admin/school-admin.repository';
import { TeacherPortalRepository } from '../modules/teacher-portal/teacher-portal.repository';

/**
 * Composition layer (ADR-008): read-only aggregation across Learning,
 * School Admin, Teacher Portal, and Assessment for a teacher's
 * landing dashboard. Depends on all four modules' repositories
 * directly — the one place in the codebase that's allowed to,
 * enforced by the `modules-cannot-import-composition`
 * dependency-cruiser rule (the dependency only ever points this way).
 */
@Controller('teacher/dashboard')
export class TeacherDashboardController {
  constructor(
    private readonly learning: LearningRepository,
    private readonly schoolAdmin: SchoolAdminRepository,
    private readonly teacherPortal: TeacherPortalRepository,
    private readonly assessment: AssessmentRepository
  ) {}

  @Get()
  async dashboard(@CurrentUser() user: AuthenticatedUser) {
    const academicYear = new Date().getFullYear();
    const [courses, timetableSlots] = await Promise.all([
      this.learning.listCourses({}),
      this.schoolAdmin.listTimetableForTeacher(user.userId, academicYear)
    ]);

    // A teacher's own dashboard should show every course they
    // actually teach, not just ones they happened to create
    // themselves. Courses are usually created by an admin (or via
    // the bulk common-subjects tool) and then assigned to a teacher
    // through a timetable slot -- that assignment, not authorship,
    // is the real signal for "this is my course." Still includes
    // self-created courses too, since a teacher creating their own
    // course and not yet having a timetable slot for it shouldn't
    // lose visibility into it either.
    const taughtCourseIds = new Set(timetableSlots.map((s) => s.courseId));
    const myCourses = courses.filter((c) => c.createdBy === user.userId || taughtCourseIds.has(c.id));

    // Pending grading spans two, otherwise-unrelated modules: regular
    // assignment submissions (Learning) and exam attempts awaiting
    // manual marking (Assessment). Neither module reaches into the
    // other's tables directly -- the counts are combined only here,
    // in composition. A real bug this fixes: the dashboard and the
    // grading page previously only ever counted assignments, so a
    // teacher whose only pending work was exam-based saw 0 pending
    // grading and an empty grading page, even with real work waiting.
    const withPendingGrading = await Promise.all(
      myCourses.map(async (course) => {
        const [assignmentGrading, examGrading] = await Promise.all([
          this.learning.countPendingGradingForCourse(course.id),
          this.assessment.countPendingGradingForCourse(course.id)
        ]);
        return {
          courseId: course.id,
          title: course.title,
          gradeLevel: course.gradeLevel,
          pendingAssignmentGrading: assignmentGrading,
          pendingExamGrading: examGrading,
          pendingGrading: assignmentGrading + examGrading
        };
      })
    );

    const lessonPlans = await Promise.all(
      myCourses.map((course) => this.teacherPortal.listLessonPlansForCourse(course.id))
    );

    return {
      teacherId: user.userId,
      courses: withPendingGrading,
      totalPendingGrading: withPendingGrading.reduce((sum, c) => sum + c.pendingGrading, 0),
      lessonPlansByCourse: Object.fromEntries(
        myCourses.map((course, i) => [course.id, lessonPlans[i]])
      )
    };
  }
}

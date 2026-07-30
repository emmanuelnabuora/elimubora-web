import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../core/auth/decorators';
import type { AuthenticatedUser } from '../core/auth/auth.types';
import { LearningRepository } from '../modules/learning/learning.repository';
import { TeacherPortalRepository } from '../modules/teacher-portal/teacher-portal.repository';

/**
 * Composition layer (ADR-008): read-only aggregation across Learning
 * and Teacher Portal for a teacher's landing dashboard. Depends on
 * both modules' repositories directly — the one place in the codebase
 * that's allowed to, enforced by the `modules-cannot-import-composition`
 * dependency-cruiser rule (the dependency only ever points this way).
 */
@Controller('teacher/dashboard')
export class TeacherDashboardController {
  constructor(
    private readonly learning: LearningRepository,
    private readonly teacherPortal: TeacherPortalRepository
  ) {}

  @Get()
  async dashboard(@CurrentUser() user: AuthenticatedUser) {
    const courses = await this.learning.listCourses({});
    const myCourses = courses.filter((c) => c.createdBy === user.userId);

    const withPendingGrading = await Promise.all(
      myCourses.map(async (course) => ({
        courseId: course.id,
        title: course.title,
        gradeLevel: course.gradeLevel,
        pendingGrading: await this.learning.countPendingGradingForCourse(course.id)
      }))
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

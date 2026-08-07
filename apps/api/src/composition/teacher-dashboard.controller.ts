import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../core/auth/decorators';
import type { AuthenticatedUser } from '../core/auth/auth.types';
import { LearningRepository } from '../modules/learning/learning.repository';
import { SchoolAdminRepository } from '../modules/school-admin/school-admin.repository';
import { TeacherPortalRepository } from '../modules/teacher-portal/teacher-portal.repository';

/**
 * Composition layer (ADR-008): read-only aggregation across Learning,
 * School Admin, and Teacher Portal for a teacher's landing dashboard.
 * Depends on all three modules' repositories directly — the one place
 * in the codebase that's allowed to, enforced by the
 * `modules-cannot-import-composition` dependency-cruiser rule (the
 * dependency only ever points this way).
 */
@Controller('teacher/dashboard')
export class TeacherDashboardController {
  constructor(
    private readonly learning: LearningRepository,
    private readonly schoolAdmin: SchoolAdminRepository,
    private readonly teacherPortal: TeacherPortalRepository
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

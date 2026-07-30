import { Module } from '@nestjs/common';
import { AttendanceSyncHandler } from './attendance-sync.handler';
import { AttendanceController, LessonPlansController } from './teacher-portal.controller';
import { TeacherPortalRepository } from './teacher-portal.repository';
import { TeacherPortalService } from './teacher-portal.service';

/**
 * Teacher Portal (Module 7 — Sprint 6 scope): attendance (offline-
 * capable, last-write-wins) and lesson plans. AI-assisted lesson
 * planning and exam generation are Sprint 12 scope.
 */
@Module({
  controllers: [AttendanceController, LessonPlansController],
  providers: [TeacherPortalRepository, TeacherPortalService, AttendanceSyncHandler],
  exports: [TeacherPortalRepository]
})
export class TeacherPortalModule {}

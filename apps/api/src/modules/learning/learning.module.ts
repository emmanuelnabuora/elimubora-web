import { Module } from '@nestjs/common';
import {
  AssignmentsController,
  CoursesController,
  SubmissionsController
} from './learning.controller';
import { LearningRepository } from './learning.repository';
import { LearningService } from './learning.service';
import { SubmissionSyncHandler } from './submission-sync.handler';

/**
 * Learning Platform (Module 2 — Sprint 4 scope): CBC-aware courses,
 * modules, lessons, competencies, assignments, enrollments and
 * submissions. Submissions are the first offline-capable entity
 * (ADR-003): SubmissionSyncHandler registers itself with the core
 * SyncService on module init, so offline-queued submissions and
 * synchronous ones share one write path (LearningRepository.upsertSubmission).
 */
@Module({
  controllers: [CoursesController, AssignmentsController, SubmissionsController],
  providers: [LearningRepository, LearningService, SubmissionSyncHandler],
  exports: [LearningRepository]
})
export class LearningModule {}

import { Module } from '@nestjs/common';
import {
  CertificatesController,
  ExamAttemptsController,
  ExamsController,
  QuestionBanksController
} from './assessment.controller';
import { AssessmentRepository } from './assessment.repository';
import { AssessmentService } from './assessment.service';

/**
 * Assessment Platform (Module 11 — Sprint 11 scope): question banks,
 * randomized exams, auto-graded MCQs with manual grading for
 * short-answer/essay, and certificates. AI-assisted marking is
 * Sprint 12 scope; a lockdown "Secure Browser" client is Sprint 15
 * (Mobile Apps) scope.
 */
@Module({
  controllers: [QuestionBanksController, ExamsController, ExamAttemptsController, CertificatesController],
  providers: [AssessmentRepository, AssessmentService],
  exports: [AssessmentRepository]
})
export class AssessmentModule {}

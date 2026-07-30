import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../core/auth/decorators';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { ZodValidationPipe } from '../../core/http/zod-validation.pipe';
import {
  createExamSchema,
  createQuestionBankSchema,
  createQuestionSchema,
  draftQuestionWithAiSchema,
  gradeAttemptSchema,
  issueCertificateSchema,
  reviewQuestionSchema,
  submitAttemptSchema,
  updateExamStatusSchema,
  type CreateExamDto,
  type CreateQuestionBankDto,
  type CreateQuestionDto,
  type DraftQuestionWithAiDto,
  type GradeAttemptDto,
  type IssueCertificateDto,
  type ReviewQuestionDto,
  type SubmitAttemptDto,
  type UpdateExamStatusDto
} from './assessment.dto';
import { AssessmentService } from './assessment.service';

@Controller('question-banks')
export class QuestionBanksController {
  constructor(private readonly service: AssessmentService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createQuestionBankSchema)) dto: CreateQuestionBankDto
  ) {
    return this.service.createQuestionBank(user, dto);
  }

  @Post(':id/questions')
  addQuestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) bankId: string,
    @Body(new ZodValidationPipe(createQuestionSchema)) dto: CreateQuestionDto
  ) {
    return this.service.createQuestion(user, bankId, dto);
  }

  @Post(':id/questions/ai-draft')
  draftQuestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) bankId: string,
    @Body(new ZodValidationPipe(draftQuestionWithAiSchema)) dto: DraftQuestionWithAiDto
  ) {
    return this.service.draftQuestionWithAi(user, bankId, dto);
  }

  @Patch('questions/:questionId/review')
  reviewQuestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body(new ZodValidationPipe(reviewQuestionSchema)) dto: ReviewQuestionDto
  ) {
    return this.service.reviewQuestion(user, questionId, dto.status);
  }
}

@Controller('exams')
export class ExamsController {
  constructor(private readonly service: AssessmentService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createExamSchema)) dto: CreateExamDto
  ) {
    return this.service.createExam(user, dto);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getExam(id);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateExamStatusSchema)) dto: UpdateExamStatusDto
  ) {
    return this.service.updateExamStatus(user, id, dto.status);
  }

  @Post(':id/attempts')
  startAttempt(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.startAttempt(user, id);
  }

  @Get(':id/attempts')
  listAttempts(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.listAttemptsForExam(user, id);
  }
}

@Controller('exam-attempts')
export class ExamAttemptsController {
  constructor(private readonly service: AssessmentService) {}

  @Get(':id/questions')
  questions(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.getAttemptQuestions(user, id);
  }

  @Post(':id/submit')
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(submitAttemptSchema)) dto: SubmitAttemptDto
  ) {
    return this.service.submitAttempt(user, id, dto);
  }

  @Patch(':id/grade')
  grade(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(gradeAttemptSchema)) dto: GradeAttemptDto
  ) {
    return this.service.gradeAttempt(user, id, dto);
  }
}

@Controller('certificates')
export class CertificatesController {
  constructor(private readonly service: AssessmentService) {}

  @Post()
  issue(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(issueCertificateSchema)) dto: IssueCertificateDto
  ) {
    return this.service.issueCertificate(user, dto);
  }

  @Get('student/:studentId')
  forStudent(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.service.listCertificates(studentId);
  }
}

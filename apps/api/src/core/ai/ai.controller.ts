import { Body, Controller, ForbiddenException, Get, Inject, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ZodValidationPipe } from '../http/zod-validation.pipe';
import { AiInteractionLogService } from './ai-interaction-log.service';
import { homeworkHelpSchema, type HomeworkHelpDto } from './ai.dto';
import { AI_PROVIDER, type AiProvider } from './ai-provider.port';

/**
 * Student-facing AI: a single-turn, logged homework helper —
 * deliberately NOT a persistent open-ended chat. Every request is a
 * standalone Q&A tied to a subject/grade, and every interaction is
 * logged (ai.interactions) for teacher/guardian visibility, not a
 * private unsupervised conversation with a minor. See
 * ai-provider.port.ts for the sandbox disclaimer — no real model is
 * called in this environment.
 */
@Controller('ai/homework-help')
export class AiController {
  constructor(
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
    private readonly log: AiInteractionLogService
  ) {}

  @Post()
  async ask(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(homeworkHelpSchema)) dto: HomeworkHelpDto
  ) {
    if (user.role !== 'learner') {
      throw new ForbiddenException('Homework help is a learner-facing feature');
    }
    const result = await this.ai.complete({
      feature: 'homework_help',
      prompt: `A ${dto.gradeLevel} learner asks about ${dto.subject}: ${dto.question}`,
      context: { subject: dto.subject, gradeLevel: dto.gradeLevel }
    });
    await this.log.record({
      userId: user.userId,
      feature: 'homework_help',
      context: { subject: dto.subject, gradeLevel: dto.gradeLevel },
      promptSummary: dto.question,
      responseSummary: result.text
    });
    return { answer: result.text };
  }

  /** A learner's own history — also the same data a future Parent Portal view would surface. */
  @Get('history')
  history(@CurrentUser() user: AuthenticatedUser) {
    return this.log.listForUser(user.userId);
  }
}

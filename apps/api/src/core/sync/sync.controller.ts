import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ZodValidationPipe } from '../http/zod-validation.pipe';
import { SyncService } from './sync.service';

const pullSchema = z.object({ cursor: z.string().regex(/^\d+$/).default('0') });
const pushSchema = z.object({
  mutations: z
    .array(
      z.object({
        id: z.string().uuid(),
        type: z.string().min(1).max(100),
        payload: z.record(z.unknown())
      })
    )
    .min(1)
    .max(100)
});

@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post('pull')
  @HttpCode(200)
  pull(
    @Body(new ZodValidationPipe(pullSchema)) body: { cursor: string }
  ) {
    return this.sync.pull(body.cursor);
  }

  @Post('push')
  @HttpCode(200)
  push(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(pushSchema))
    body: { mutations: Array<{ id: string; type: string; payload: Record<string, unknown> }> }
  ) {
    return this.sync.push(body.mutations, user);
  }
}

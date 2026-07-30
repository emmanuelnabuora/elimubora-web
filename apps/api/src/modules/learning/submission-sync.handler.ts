import { randomUUID } from 'node:crypto';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { AuditService } from '../../core/audit/audit.service';
import { OutboxService } from '../../core/outbox/outbox.service';
import { SyncService } from '../../core/sync/sync.service';
import type { MutationHandler, MutationOutcome } from '../../core/sync/sync.types';
import { LearningRepository } from './learning.repository';

const payloadSchema = z.object({
  assignmentId: z.string().uuid(),
  content: z.record(z.unknown())
});

/**
 * Handles `submission.create.v1` mutations pushed from offline
 * clients. Conflict class (ADR-003): CREATE-ONLY. A learner may be
 * offline for days composing an answer; the mutation id (client
 * UUID) is the idempotency key, and the DB unique constraint on
 * (assignment_id, learner_id) is the second line of defense — one
 * submission per learner per assignment, first write wins. Grading
 * fields are never accepted here: they are server-authoritative and
 * only reachable through the authenticated grade-submission endpoint.
 */
@Injectable()
export class SubmissionSyncHandler implements MutationHandler, OnModuleInit {
  readonly type = 'submission.create.v1';

  constructor(
    private readonly sync: SyncService,
    private readonly repo: LearningRepository,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService
  ) {}

  onModuleInit(): void {
    this.sync.registerHandler(this);
  }

  async apply(
    client: PoolClient,
    rawPayload: Record<string, unknown>,
    actor: AuthenticatedUser
  ): Promise<MutationOutcome> {
    const parsed = payloadSchema.safeParse(rawPayload);
    if (!parsed.success) {
      return { status: 'rejected', reason: parsed.error.issues.map((i) => i.message).join('; ') };
    }
    const { assignmentId, content } = parsed.data;

    const enrolled = await client.query(
      `SELECT 1 FROM learning.enrollments
        WHERE course_id = (SELECT course_id FROM learning.assignments WHERE id = $1)
          AND user_id = $2 AND course_role = 'learner'
          AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL`,
      [assignmentId, actor.userId]
    );
    if (enrolled.rowCount === 0) {
      return { status: 'rejected', reason: 'Not enrolled as a learner in this course' };
    }

    const { submission, created } = await this.repo.upsertSubmission(client, {
      id: randomUUID(),
      assignmentId,
      learnerId: actor.userId,
      content
    });

    if (created) {
      await this.audit.record(client, {
        action: 'submission.created',
        entityType: 'submission',
        entityId: submission.id,
        after: { assignmentId }
      });
      await this.outbox.append(client, {
        aggregateType: 'submission',
        aggregateId: submission.id,
        eventType: 'submission.created.v1',
        payload: { submissionId: submission.id, assignmentId, learnerId: actor.userId }
      });
    }

    return { status: 'applied', data: { submissionId: submission.id, alreadyExisted: !created } };
  }
}

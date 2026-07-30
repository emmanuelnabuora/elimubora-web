import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { SyncService } from '../../core/sync/sync.service';
import type { MutationHandler, MutationOutcome } from '../../core/sync/sync.types';
import { TeacherPortalRepository } from './teacher-portal.repository';

const payloadSchema = z.object({
  classStreamId: z.string().uuid(),
  learnerId: z.string().uuid(),
  attendanceDate: z.string().date(),
  status: z.enum(['present', 'absent', 'late', 'excused'])
});

/**
 * Handles `attendance.mark.v1` mutations. Conflict class (ADR-009):
 * LAST-WRITE-WINS — deliberately the opposite of submissions'
 * create-only rule. If a teacher's phone and a teaching assistant's
 * tablet both mark the same student's attendance for the same day
 * while both are offline, whichever mutation the server happens to
 * apply LAST simply overwrites the other. No merge, no rejection,
 * no "conflict" surfaced to either device — this matches how a real
 * classroom actually works (the most recent correction is authoritative).
 */
@Injectable()
export class AttendanceSyncHandler implements MutationHandler, OnModuleInit {
  readonly type = 'attendance.mark.v1';

  constructor(
    private readonly sync: SyncService,
    private readonly repo: TeacherPortalRepository
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
    const record = await this.repo.markAttendance(
      { ...parsed.data, recordedBy: actor.userId },
      client
    );
    return { status: 'applied', data: { attendanceId: record.id, status: record.status } };
  }
}

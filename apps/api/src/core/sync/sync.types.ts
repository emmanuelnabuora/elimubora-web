import type { PoolClient } from 'pg';
import type { AuthenticatedUser } from '../auth/auth.types';

/** One entry in the pull feed. */
export interface ChangeEntry {
  seq: string;
  table: string;
  rowId: string;
  op: 'insert' | 'update' | 'delete';
  rowVersion: string;
  payload: Record<string, unknown> | null;
}

export interface PullResult {
  changes: ChangeEntry[];
  nextCursor: string;
  hasMore: boolean;
}

/** A queued offline mutation replayed by a client. */
export interface SyncMutation {
  /** Client-generated UUID — the idempotency key. */
  id: string;
  type: string;
  payload: Record<string, unknown>;
}

export type MutationOutcome =
  | { status: 'applied'; data: Record<string, unknown> }
  | { status: 'rejected'; reason: string };

/**
 * Modules register handlers for the mutation types they own. The
 * handler runs inside the sync transaction (tenant + actor bound),
 * so its writes, its audit rows and the idempotency record commit
 * or roll back together.
 */
export interface MutationHandler {
  readonly type: string;
  apply(
    client: PoolClient,
    payload: Record<string, unknown>,
    actor: AuthenticatedUser
  ): Promise<MutationOutcome>;
}

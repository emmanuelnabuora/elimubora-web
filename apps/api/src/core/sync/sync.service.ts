import { Inject, BadRequestException, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import type { AuthenticatedUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import type {
  ChangeEntry,
  MutationHandler,
  MutationOutcome,
  PullResult,
  SyncMutation
} from './sync.types';

const PULL_LIMIT = 500;

/**
 * Mutation handlers are registered imperatively (registerHandler),
 * not injected as a Nest multi-provider — Nest has no native
 * multi-binding for arbitrary tokens. Each domain module owns a
 * small OnModuleInit provider that calls registerHandler for the
 * mutation types it handles. This keeps SyncService in core with
 * zero compile-time knowledge of any domain module, preserving the
 * "modules never import each other, core never imports modules" rule.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly handlers = new Map<string, MutationHandler>();

  constructor(
    private readonly db: DatabaseService,
    @Inject(APP_CONFIG) private readonly config: AppConfig
  ) {}

  registerHandler(handler: MutationHandler): void {
    if (this.handlers.has(handler.type)) {
      throw new Error(`Duplicate sync mutation handler for type ${handler.type}`);
    }
    this.handlers.set(handler.type, handler);
    this.logger.log(`Registered sync mutation handler: ${handler.type}`);
  }

  async pull(cursor: string): Promise<PullResult> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{
        seq: string;
        table_name: string;
        row_id: string;
        op: 'insert' | 'update' | 'delete';
        row_version: string;
        payload: Record<string, unknown> | null;
      }>(
        `SELECT seq, table_name, row_id, op, row_version, payload
           FROM core.change_log
          WHERE tenant_id = core.current_tenant_id()
            AND seq > $1
            AND created_at < now() - make_interval(secs => $2)
          ORDER BY seq
          LIMIT $3`,
        [cursor, this.config.syncVisibilityDelaySeconds, PULL_LIMIT + 1]
      );
      const page = rows.slice(0, PULL_LIMIT);
      const changes: ChangeEntry[] = page.map((r) => ({
        seq: r.seq,
        table: r.table_name,
        rowId: r.row_id,
        op: r.op,
        rowVersion: r.row_version,
        payload: r.payload
      }));
      const last = page[page.length - 1];
      return {
        changes,
        nextCursor: last ? last.seq : cursor,
        hasMore: rows.length > PULL_LIMIT
      };
    });
  }

  /**
   * Applies mutations in order, one transaction each. Idempotent:
   * a mutation id seen before returns its stored outcome. Delivery
   * contract with clients: retry until acknowledged, dedupe by id.
   */
  async push(
    mutations: SyncMutation[],
    actor: AuthenticatedUser
  ): Promise<Array<{ id: string; outcome: MutationOutcome }>> {
    const results: Array<{ id: string; outcome: MutationOutcome }> = [];
    for (const mutation of mutations) {
      const handler = this.handlers.get(mutation.type);
      if (!handler) {
        throw new BadRequestException(`Unknown mutation type: ${mutation.type}`);
      }
      const outcome = await this.db.withTenantTransaction(async (client) => {
        const existing = await client.query<{ result: MutationOutcome }>(
          `SELECT result FROM core.applied_mutations WHERE mutation_id = $1`,
          [mutation.id]
        );
        if (existing.rows[0]) return existing.rows[0].result;

        const applied = await handler.apply(client, mutation.payload, actor);
        await client.query(
          `INSERT INTO core.applied_mutations (mutation_id, tenant_id, actor_id, type, result)
           VALUES ($1, core.current_tenant_id(), $2, $3, $4::jsonb)`,
          [mutation.id, actor.userId, mutation.type, JSON.stringify(applied)]
        );
        return applied;
      });
      results.push({ id: mutation.id, outcome });
    }
    return results;
  }
}

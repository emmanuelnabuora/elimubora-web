import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { TenantContext } from '../tenancy/tenant-context';

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  actorType?: 'user' | 'service' | 'system';
}

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorType: string;
  action: string;
  entityType: string;
  entityId: string | null;
  occurredAt: string;
}

/**
 * Writes to the append-only audit log. Always called with the SAME
 * client/transaction as the state change it records, so an audit row
 * can never exist without its change (and vice versa). RLS stamps the
 * tenant; the app role has no UPDATE/DELETE grant on this table.
 */
@Injectable()
export class AuditService {
  constructor(private readonly db: DatabaseService) {}

  async record(client: PoolClient, entry: AuditEntry): Promise<void> {
    const ctx = TenantContext.current();
    await client.query(
      `INSERT INTO core.audit_log
         (tenant_id, actor_id, actor_type, action, entity_type, entity_id,
          before, after, request_id)
       VALUES (core.current_tenant_id(), core.current_actor_id(), $1, $2, $3, $4,
               $5::jsonb, $6::jsonb, $7)`,
      [
        entry.actorType ?? 'user',
        entry.action,
        entry.entityType,
        entry.entityId ?? null,
        entry.before === undefined ? null : JSON.stringify(entry.before),
        entry.after === undefined ? null : JSON.stringify(entry.after),
        ctx?.requestId ?? null
      ]
    );
  }

  /**
   * A real gap: this service could previously only write, never read
   * back what it wrote — no admin-facing way existed to actually look
   * at the audit trail Sprint 1 built. LEFT JOIN, not INNER, since
   * actor_id is genuinely nullable here (service/system-originated
   * entries, e.g. the outbox relay, have no real user behind them).
   */
  async listRecent(limit = 100): Promise<AuditLogEntry[]> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{
        id: string;
        actor_id: string | null;
        actor_name: string | null;
        actor_type: string;
        action: string;
        entity_type: string;
        entity_id: string | null;
        occurred_at: Date;
      }>(
        `SELECT a.id, a.actor_id, u.full_name AS actor_name, a.actor_type,
                a.action, a.entity_type, a.entity_id, a.occurred_at
           FROM core.audit_log a
           LEFT JOIN core.users u ON u.id = a.actor_id
          WHERE a.tenant_id = core.current_tenant_id()
          ORDER BY a.occurred_at DESC
          LIMIT $1`,
        [Math.min(limit, 500)]
      );
      return rows.map((r) => ({
        id: r.id,
        actorId: r.actor_id,
        actorName: r.actor_name,
        actorType: r.actor_type,
        action: r.action,
        entityType: r.entity_type,
        entityId: r.entity_id,
        occurredAt: r.occurred_at.toISOString()
      }));
    });
  }
}

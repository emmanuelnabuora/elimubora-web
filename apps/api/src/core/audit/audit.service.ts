import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { TenantContext } from '../tenancy/tenant-context';

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  actorType?: 'user' | 'service' | 'system';
}

/**
 * Writes to the append-only audit log. Always called with the SAME
 * client/transaction as the state change it records, so an audit row
 * can never exist without its change (and vice versa). RLS stamps the
 * tenant; the app role has no UPDATE/DELETE grant on this table.
 */
@Injectable()
export class AuditService {
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
}

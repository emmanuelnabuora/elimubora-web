import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

export interface OutboxAppend {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

/**
 * Appends a domain event in the caller's transaction (transactional
 * outbox pattern). If the business change commits, the event exists;
 * if it rolls back, the event never happened. The relay publishes
 * asynchronously — producers never talk to a broker directly.
 */
@Injectable()
export class OutboxService {
  async append(client: PoolClient, event: OutboxAppend): Promise<string> {
    const result = await client.query<{ event_id: string }>(
      `INSERT INTO core.outbox
         (tenant_id, aggregate_type, aggregate_id, event_type, payload)
       VALUES (core.current_tenant_id(), $1, $2, $3, $4::jsonb)
       RETURNING event_id`,
      [event.aggregateType, event.aggregateId, event.eventType, JSON.stringify(event.payload)]
    );
    const row = result.rows[0];
    if (!row) throw new Error('Outbox insert returned no row');
    return row.event_id;
  }
}

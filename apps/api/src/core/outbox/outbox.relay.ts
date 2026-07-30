import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit
} from '@nestjs/common';
import { Pool } from 'pg';
import type { DomainEvent } from '@elimubora/domain';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import { EVENT_PUBLISHER, type EventPublisher } from './event-publisher';

interface OutboxRow {
  id: string;
  event_id: string;
  tenant_id: string | null;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  occurred_at: Date;
  attempts: number;
}

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 10;

/**
 * Polls core.outbox for unpublished events and hands them to the
 * configured EventPublisher. Delivery is at-least-once: consumers
 * dedupe on eventId. Uses FOR UPDATE SKIP LOCKED so multiple API
 * replicas can run the relay concurrently without double-delivery
 * races inside a batch.
 *
 * Connects with the worker role (granted explicit cross-tenant RLS
 * policies) because it must read
 * events across all tenants.
 */
@Injectable()
export class OutboxRelay implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelay.name);
  private readonly pool: Pool;
  private timer?: NodeJS.Timeout;
  private draining = false;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(EVENT_PUBLISHER) private readonly publisher: EventPublisher
  ) {
    this.pool = new Pool({ connectionString: config.workerDatabaseUrl, max: 2 });
  }

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.tick();
    }, this.config.outboxPollMs);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.draining = true;
    await this.pool.end();
  }

  /** One polling cycle. Public for deterministic testing. */
  async tick(): Promise<number> {
    if (this.draining) return 0;
    const client = await this.pool.connect();
    let published = 0;
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<OutboxRow>(
        `SELECT id, event_id, tenant_id, aggregate_type, aggregate_id,
                event_type, payload, occurred_at, attempts
           FROM core.outbox
          WHERE published_at IS NULL AND attempts < $1
          ORDER BY id
          LIMIT $2
          FOR UPDATE SKIP LOCKED`,
        [MAX_ATTEMPTS, BATCH_SIZE]
      );

      for (const row of rows) {
        const event: DomainEvent = {
          eventId: row.event_id,
          tenantId: row.tenant_id,
          aggregateType: row.aggregate_type,
          aggregateId: row.aggregate_id,
          eventType: row.event_type,
          payload: row.payload,
          occurredAt: row.occurred_at.toISOString()
        };
        try {
          await this.publisher.publish(event);
          await client.query('UPDATE core.outbox SET published_at = now() WHERE id = $1', [
            row.id
          ]);
          published += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Delivery failed for ${row.event_type} (${row.event_id}): ${message}`);
          await client.query(
            'UPDATE core.outbox SET attempts = attempts + 1, last_error = $2 WHERE id = $1',
            [row.id, message.slice(0, 1000)]
          );
        }
      }
      await client.query('COMMIT');
      return published;
    } catch (err) {
      await client.query('ROLLBACK');
      this.logger.error(`Relay cycle failed: ${err instanceof Error ? err.message : err}`);
      return published;
    } finally {
      client.release();
    }
  }
}

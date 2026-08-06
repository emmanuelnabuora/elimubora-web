import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';

/**
 * A second connection pool, authenticated as `elimubora_worker`
 * rather than `elimubora_app` — the cross-tenant reader role ADR-002
 * always anticipated for background jobs. `elimubora_worker` has
 * explicit `USING (true)` read policies on tenant-scoped tables (see
 * `core.make_syncable`) precisely so aggregation across every tenant
 * is possible without bypassing RLS via a superuser or BYPASSRLS.
 *
 * CRITICAL BOUNDARY: this service must NEVER be used to serve an
 * ordinary authenticated request's own data. It exists only for
 * background/admin-triggered cross-tenant aggregation (Government
 * Dashboard's snapshot refresh today; Analytics in Sprint 14 will
 * need the identical capability). Any query run through here reads
 * or writes across every tenant — there is no ambient tenant
 * isolation to rely on, unlike `DatabaseService.withTenantTransaction`.
 */
@Injectable()
export class WorkerDatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerDatabaseService.name);
  private readonly pool: Pool;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.pool = new Pool({
      connectionString: config.workerDatabaseUrl,
      // Same reasoning as DatabaseService's own pool: this runs in
      // the same process, and the real ceiling is Postgres's total
      // max_connections shared across every scaled-up instance, not
      // what looks reasonable for one instance alone.
      max: 2,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000
    });
  }

  async onModuleInit(): Promise<void> {
    await this.pool.query('SELECT 1');
    this.logger.log('Worker database pool ready');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  query<T extends Record<string, unknown>>(
    text: string,
    params: unknown[] = []
  ): Promise<{ rows: T[] }> {
    return this.pool.query<T>(text, params as never);
  }
}

import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit
} from '@nestjs/common';
import { Pool, type PoolClient } from 'pg';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import { TenantContext } from '../tenancy/tenant-context';

/**
 * Postgres access for the API. Two rules are absolute:
 *
 * 1. All tenant-scoped work happens inside `withTenantTransaction`,
 *    which binds `app.tenant_id` / `app.actor_id` as transaction-local
 *    settings. Row-Level Security policies read these — isolation is
 *    enforced by the database, not by remembering WHERE clauses.
 * 2. The pool connects as `elimubora_app`, a role subject to FORCE RLS
 *    with no UPDATE/DELETE grant on append-only tables.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.pool = new Pool({
      connectionString: config.databaseUrl,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000
    });
    this.pool.on('error', (err) => this.logger.error(`Idle client error: ${err.message}`));
  }

  async onModuleInit(): Promise<void> {
    await this.pool.query('SELECT 1');
    this.logger.log('Database pool ready');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  /** Untenanted query — for global tables (users lookup, health checks). */
  query<T extends Record<string, unknown>>(
    text: string,
    params: unknown[] = []
  ): Promise<{ rows: T[] }> {
    return this.pool.query<T>(text, params as never);
  }

  /**
   * Transaction with explicit RLS bindings. Either setting may be
   * omitted (e.g. login binds only the actor to read the caller's
   * own memberships across tenants).
   */
  async withContext<T>(
    bindings: { tenantId?: string; actorId?: string },
    fn: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      if (bindings.tenantId) {
        await client.query("SELECT set_config('app.tenant_id', $1, true)", [bindings.tenantId]);
      }
      if (bindings.actorId) {
        await client.query("SELECT set_config('app.actor_id', $1, true)", [bindings.actorId]);
      }
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /** Tenant-scoped transaction using the current request context. */
  async withTenantTransaction<T>(
    fn: (client: PoolClient) => Promise<T>,
    overrides?: { tenantId?: string; actorId?: string }
  ): Promise<T> {
    const ctx = TenantContext.current();
    const tenantId = overrides?.tenantId ?? ctx?.tenantId;
    const actorId = overrides?.actorId ?? ctx?.actorId;
    if (!tenantId) {
      throw new Error('withTenantTransaction requires a tenant in context');
    }
    return this.withContext({ tenantId, actorId }, fn);
  }

  /** Latency probe used by the health endpoint. */
  async ping(): Promise<number> {
    const start = process.hrtime.bigint();
    await this.pool.query('SELECT 1');
    return Number(process.hrtime.bigint() - start) / 1_000_000;
  }
}

import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../core/database/database.service';
import { WorkerDatabaseService } from '../../core/database/worker-database.service';
import type { ListQueryDto } from './platform-admin.dto';
import type { PlatformInstitution, PlatformUserRow } from './platform-admin.types';

@Injectable()
export class PlatformAdminRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly workerDb: WorkerDatabaseService
  ) {}

  async overview() {
    const [institutions, users, alerts, tickets] = await Promise.all([
      this.db.query<{ total: string; active: string }>(`
        SELECT count(*)::text AS total,
               count(*) FILTER (WHERE status = 'active')::text AS active
        FROM core.tenants WHERE deleted_at IS NULL
      `),
      this.db.query<{ total: string }>(`SELECT count(*)::text AS total FROM core.users WHERE deleted_at IS NULL`),
      this.db.query<{ total: string }>(`SELECT count(*)::text AS total FROM platform.security_alerts WHERE status = 'open'`),
      this.db.query<{ total: string }>(`SELECT count(*)::text AS total FROM platform.support_tickets WHERE status NOT IN ('resolved','closed')`)
    ]);

    return {
      institutions: Number(institutions.rows[0]?.total ?? 0),
      activeInstitutions: Number(institutions.rows[0]?.active ?? 0),
      users: Number(users.rows[0]?.total ?? 0),
      openSecurityAlerts: Number(alerts.rows[0]?.total ?? 0),
      openSupportTickets: Number(tickets.rows[0]?.total ?? 0)
    };
  }

  async listInstitutions(query: ListQueryDto): Promise<{ rows: PlatformInstitution[]; total: number }> {
    const filters: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];
    const add = (value: unknown): string => { params.push(value); return `$${params.length}`; };
    if (query.q) filters.push(`(name ILIKE ${add(`%${query.q}%`)} OR slug::text ILIKE $${params.length} OR nemis_code ILIKE $${params.length})`);
    if (query.status) filters.push(`status = ${add(query.status)}`);
    if (query.kind) filters.push(`kind = ${add(query.kind)}`);
    if (query.countyCode) filters.push(`county_code = ${add(query.countyCode)}`);
    const where = filters.join(' AND ');
    const limitParam = add(query.limit);
    const offsetParam = add(query.offset);
    const { rows } = await this.db.query<Record<string, unknown>>(`
      SELECT id, name, slug::text, kind, county_code, nemis_code, status, created_at,
             count(*) OVER()::int AS total_count
      FROM core.tenants
      WHERE ${where}
      ORDER BY created_at DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `, params);
    const total = Number(rows[0]?.total_count ?? 0);
    return {
      total,
      rows: rows.map((r) => ({
        id: String(r.id), name: String(r.name), slug: String(r.slug), kind: String(r.kind),
        countyCode: r.county_code ? String(r.county_code) : null,
        nemisCode: r.nemis_code ? String(r.nemis_code) : null,
        status: String(r.status) as PlatformInstitution['status'],
        createdAt: new Date(r.created_at as Date | string).toISOString()
      }))
    };
  }

  async updateInstitutionStatus(actorId: string, actorTenantId: string, institutionId: string, status: string, reason: string) {
    return this.db.withContext({ tenantId: actorTenantId, actorId }, async (client) => {
      const before = await client.query('SELECT id, name, status FROM core.tenants WHERE id = $1 AND deleted_at IS NULL FOR UPDATE', [institutionId]);
      if (!before.rows[0]) return null;
      const updated = await client.query('UPDATE core.tenants SET status = $2 WHERE id = $1 RETURNING id, name, status, updated_at', [institutionId, status]);
      await client.query(`
        INSERT INTO core.audit_log (tenant_id, actor_id, action, entity_type, entity_id, before, after)
        VALUES ($1, $2, 'platform.tenant.status_changed', 'tenant', $3, $4::jsonb, $5::jsonb)
      `, [actorTenantId, actorId, institutionId, JSON.stringify(before.rows[0]), JSON.stringify({ ...updated.rows[0], reason })]);
      return updated.rows[0];
    });
  }

  async listUsers(query: ListQueryDto): Promise<{ rows: PlatformUserRow[]; total: number }> {
    const q = query.q ? `%${query.q}%` : null;
    const { rows } = await this.workerDb.query<Record<string, unknown>>(`
      WITH filtered AS (
        SELECT u.id, u.full_name, u.email::text, u.phone, u.status, u.totp_enabled, u.created_at
        FROM core.users u
        WHERE u.deleted_at IS NULL
          AND ($1::text IS NULL OR u.full_name ILIKE $1 OR u.email::text ILIKE $1 OR coalesce(u.phone,'') ILIKE $1)
      )
      SELECT f.*,
             count(*) OVER()::int AS total_count,
             coalesce(json_agg(json_build_object(
               'tenantId', m.tenant_id,
               'tenantName', t.name,
               'role', m.role,
               'status', m.status
             )) FILTER (WHERE m.id IS NOT NULL), '[]'::json) AS roles
      FROM filtered f
      LEFT JOIN core.memberships m ON m.user_id = f.id AND m.deleted_at IS NULL
      LEFT JOIN core.tenants t ON t.id = m.tenant_id
      GROUP BY f.id, f.full_name, f.email, f.phone, f.status, f.totp_enabled, f.created_at
      ORDER BY f.created_at DESC
      LIMIT $2 OFFSET $3
    `, [q, query.limit, query.offset]);
    return {
      total: Number(rows[0]?.total_count ?? 0),
      rows: rows.map((r) => ({
        id: String(r.id), fullName: String(r.full_name), email: String(r.email),
        phone: r.phone ? String(r.phone) : null, status: String(r.status),
        totpEnabled: Boolean(r.totp_enabled), roles: (r.roles ?? []) as PlatformUserRow['roles'],
        createdAt: new Date(r.created_at as Date | string).toISOString()
      }))
    };
  }

  async revokeUserSessions(actorId: string, actorTenantId: string, userId: string, reason: string) {
    return this.db.withContext({ tenantId: actorTenantId, actorId }, async (client) => {
      const result = await client.query(`UPDATE core.refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL RETURNING id`, [userId]);
      await client.query(`INSERT INTO core.audit_log (tenant_id, actor_id, action, entity_type, entity_id, after)
        VALUES ($1, $2, 'platform.user.sessions_revoked', 'user', $3, $4::jsonb)`,
        [actorTenantId, actorId, userId, JSON.stringify({ reason, revokedCount: result.rowCount ?? 0 })]);
      return { revoked: result.rowCount ?? 0 };
    });
  }

  async securityAlerts(limit = 50) {
    const { rows } = await this.db.query<Record<string, unknown>>(`SELECT * FROM platform.security_alerts ORDER BY created_at DESC LIMIT $1`, [limit]);
    return rows;
  }

  async acknowledgeAlert(actorId: string, actorTenantId: string, alertId: string, note?: string) {
    return this.db.withContext({ tenantId: actorTenantId, actorId }, async (client) => {
      const result = await client.query(`UPDATE platform.security_alerts SET status='acknowledged', acknowledged_by=$2, acknowledged_at=now(), resolution_note=$3 WHERE id=$1 RETURNING *`, [alertId, actorId, note ?? null]);
      if (!result.rows[0]) return null;
      await client.query(`INSERT INTO core.audit_log (tenant_id, actor_id, action, entity_type, entity_id, after)
        VALUES ($1,$2,'platform.security_alert.acknowledged','security_alert',$3,$4::jsonb)`,
        [actorTenantId, actorId, alertId, JSON.stringify({ note: note ?? null })]);
      return result.rows[0];
    });
  }

  async supportTickets(limit = 50) {
    const { rows } = await this.db.query<Record<string, unknown>>(`SELECT * FROM platform.support_tickets ORDER BY created_at DESC LIMIT $1`, [limit]);
    return rows;
  }

  async updateSupportTicket(actorId: string, actorTenantId: string, ticketId: string, status: string, note?: string) {
    return this.db.withContext({ tenantId: actorTenantId, actorId }, async (client) => {
      const result = await client.query(`UPDATE platform.support_tickets SET status=$2, last_note=$3 WHERE id=$1 RETURNING *`, [ticketId, status, note ?? null]);
      if (!result.rows[0]) return null;
      await client.query(`INSERT INTO core.audit_log (tenant_id, actor_id, action, entity_type, entity_id, after)
        VALUES ($1,$2,'platform.support_ticket.status_changed','support_ticket',$3,$4::jsonb)`,
        [actorTenantId, actorId, ticketId, JSON.stringify({ status, note: note ?? null })]);
      return result.rows[0];
    });
  }

  async featureFlags() {
    const { rows } = await this.db.query<Record<string, unknown>>(`SELECT * FROM platform.feature_flags ORDER BY key`);
    return rows;
  }

  async updateFeatureFlag(actorId: string, actorTenantId: string, key: string, enabled: boolean, rolloutPercentage: number, reason: string) {
    return this.db.withContext({ tenantId: actorTenantId, actorId }, async (client) => {
      const before = await client.query(`SELECT * FROM platform.feature_flags WHERE key=$1 FOR UPDATE`, [key]);
      const result = await client.query(`UPDATE platform.feature_flags SET enabled=$2, rollout_percentage=$3, updated_by=$4 WHERE key=$1 RETURNING *`, [key, enabled, rolloutPercentage, actorId]);
      if (!result.rows[0]) return null;
      await client.query(`INSERT INTO core.audit_log (tenant_id, actor_id, action, entity_type, entity_id, before, after)
        VALUES ($1,$2,'platform.feature_flag.updated','feature_flag',$3,$4::jsonb,$5::jsonb)`,
        [actorTenantId, actorId, key, JSON.stringify(before.rows[0] ?? null), JSON.stringify({ ...result.rows[0], reason })]);
      return result.rows[0];
    });
  }

  async operationsHealth() {
    const latencyMs = await this.db.ping();
    return {
      generatedAt: new Date().toISOString(),
      services: [
        { name: 'API', status: 'healthy', latencyMs: Math.round(latencyMs) },
        { name: 'PostgreSQL', status: 'healthy', latencyMs: Math.round(latencyMs) },
        { name: 'Redis', status: 'unknown', latencyMs: null },
        { name: 'Object Storage', status: 'unknown', latencyMs: null },
        { name: 'Message Queue', status: 'unknown', latencyMs: null }
      ]
    };
  }
}

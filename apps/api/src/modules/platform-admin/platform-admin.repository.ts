import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../core/database/database.service';
import { WorkerDatabaseService } from '../../core/database/worker-database.service';
import type { ListQueryDto } from './platform-admin.dto';
import type { PlatformInstitution, PlatformInstitutionOverview, PlatformUserRow } from './platform-admin.types';

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

  async getInstitutionOverview(id: string): Promise<PlatformInstitutionOverview | null> {
    const tenantResult = await this.db.query<Record<string, unknown>>(
      `SELECT id, name, slug::text, kind, county_code, nemis_code, status, created_at, settings
       FROM core.tenants WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    const tenant = tenantResult.rows[0];
    if (!tenant) return null;

    const [enrollmentResult, studentsResult, adminsResult, invitesResult, streamsResult] = await Promise.all([
      this.workerDb.query<{ teachers: string; parents: string; school_admins: string; principals: string }>(
        `SELECT
           count(*) FILTER (WHERE role = 'teacher')::text AS teachers,
           count(*) FILTER (WHERE role = 'parent')::text AS parents,
           count(*) FILTER (WHERE role = 'school_admin')::text AS school_admins,
           count(*) FILTER (WHERE role = 'principal')::text AS principals
         FROM core.memberships
         WHERE tenant_id = $1 AND status = 'active' AND deleted_at IS NULL`,
        [id]
      ),
      this.workerDb.query<{ total: string }>(
        `SELECT count(*)::text AS total FROM sis.student_profiles
         WHERE tenant_id = $1 AND status = 'active' AND deleted_at IS NULL`,
        [id]
      ),
      this.workerDb.query<{ id: string; full_name: string; email: string; role: string; created_at: Date | string }>(
        `SELECT u.id, u.full_name, u.email, m.role, m.created_at
         FROM core.memberships m
         JOIN core.users u ON u.id = m.user_id
         WHERE m.tenant_id = $1 AND m.role IN ('school_admin', 'principal')
           AND m.status = 'active' AND m.deleted_at IS NULL AND u.deleted_at IS NULL
         ORDER BY m.created_at ASC`,
        [id]
      ),
      this.workerDb.query<{ id: string; email: string; role: string; expires_at: Date | string; created_at: Date | string }>(
        `SELECT id, email, role, expires_at, created_at
         FROM core.invitations
         WHERE tenant_id = $1 AND role IN ('school_admin', 'principal')
           AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()
         ORDER BY created_at DESC`,
        [id]
      ),
      this.workerDb.query<{ grade_level: string; academic_year: number; stream_names: string[]; stream_count: string }>(
        `SELECT grade_level, academic_year, array_agg(name ORDER BY name) AS stream_names, count(*)::text AS stream_count
         FROM sis.class_streams
         WHERE tenant_id = $1 AND deleted_at IS NULL
         GROUP BY grade_level, academic_year
         ORDER BY academic_year DESC, grade_level`,
        [id]
      )
    ]);

    const e = enrollmentResult.rows[0];

    return {
      id: String(tenant.id),
      name: String(tenant.name),
      slug: String(tenant.slug),
      kind: String(tenant.kind),
      countyCode: tenant.county_code ? String(tenant.county_code) : null,
      nemisCode: tenant.nemis_code ? String(tenant.nemis_code) : null,
      status: String(tenant.status) as PlatformInstitution['status'],
      createdAt: new Date(tenant.created_at as Date | string).toISOString(),
      settings: (tenant.settings as Record<string, unknown>) ?? {},
      enrollment: {
        students: Number(studentsResult.rows[0]?.total ?? 0),
        teachers: Number(e?.teachers ?? 0),
        parents: Number(e?.parents ?? 0),
        schoolAdmins: Number(e?.school_admins ?? 0),
        principals: Number(e?.principals ?? 0)
      },
      adminContacts: adminsResult.rows.map((r) => ({
        id: String(r.id),
        fullName: String(r.full_name),
        email: String(r.email),
        role: String(r.role),
        joinedAt: new Date(r.created_at).toISOString()
      })),
      pendingAdminInvites: invitesResult.rows.map((r) => ({
        id: String(r.id),
        email: String(r.email),
        role: String(r.role),
        expiresAt: new Date(r.expires_at).toISOString(),
        createdAt: new Date(r.created_at).toISOString()
      })),
      classStreams: streamsResult.rows.map((r) => ({
        gradeLevel: String(r.grade_level),
        academicYear: Number(r.academic_year),
        streamNames: r.stream_names ?? [],
        streamCount: Number(r.stream_count)
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

  /**
   * Soft delete only -- see 0001_foundation.sql: core.tenants.deleted_at
   * exists specifically for this. A real DELETE FROM core.tenants would
   * either cascade-destroy years of student/academic records across
   * ~49 FK-referencing tables, or (for the ~47 of those without ON
   * DELETE CASCADE) simply fail outright with a constraint violation.
   *
   * Setting deleted_at is also not cosmetic: the login membership
   * lookup (identity.repository.ts) already filters
   * `AND t.deleted_at IS NULL`, so every user of this tenant is locked
   * out of it immediately, with no separate per-membership update
   * needed. It does NOT touch core.users rows -- a person can belong
   * to more than one tenant, and deleting one shouldn't touch their
   * account or their access to any other tenant they're in.
   *
   * Sessions for every currently-active member of this tenant are also
   * revoked in the same transaction, for the same reason
   * revokeUserSessions exists: without it, anyone already holding a
   * still-valid access token could keep acting in this tenant for up
   * to AUTH_ACCESS_TTL_SECONDS (15 minutes by default) after "delete"
   * was clicked, even though deleted_at now says otherwise.
   *
   * confirmName is checked here, not just in the DTO shape, against
   * the tenant's actual current name -- case/whitespace-insensitively,
   * since this is meant to catch someone deleting the wrong row, not
   * to be a puzzle.
   */
  async deleteInstitution(
    actorId: string,
    actorTenantId: string,
    tenantId: string,
    confirmName: string,
    reason: string
  ): Promise<{ ok: true; id: string; name: string } | { ok: false; error: 'not_found' | 'name_mismatch' }> {
    return this.db.withContext({ tenantId: actorTenantId, actorId }, async (client) => {
      const before = await client.query<{ id: string; name: string; status: string }>(
        'SELECT id, name, status FROM core.tenants WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
        [tenantId]
      );
      const tenant = before.rows[0];
      if (!tenant) return { ok: false, error: 'not_found' };
      if (tenant.name.trim().toLowerCase() !== confirmName.trim().toLowerCase()) {
        return { ok: false, error: 'name_mismatch' };
      }

      await client.query(
        `UPDATE core.tenants SET status = 'archived', deleted_at = now() WHERE id = $1`,
        [tenantId]
      );

      // core.memberships' RLS restricts elimubora_app to the actor's
      // own bound tenant -- irrelevant here, since we need every
      // member of the tenant being DELETED, not the platform_admin's
      // own. core.platform_tenant_member_ids (0036) is the narrow
      // SECURITY DEFINER escape hatch for exactly this; the actual
      // revoke below is ordinary elimubora_app SQL, since
      // core.refresh_tokens has no RLS at all.
      const memberIds = await client.query<{ platform_tenant_member_ids: string[] }>(
        'SELECT core.platform_tenant_member_ids($1)',
        [tenantId]
      );
      const userIds = memberIds.rows[0]?.platform_tenant_member_ids ?? [];

      const sessions = userIds.length
        ? await client.query<{ id: string }>(
            `UPDATE core.refresh_tokens
                SET revoked_at = now()
              WHERE revoked_at IS NULL AND user_id = ANY($1::uuid[])
              RETURNING id`,
            [userIds]
          )
        : { rowCount: 0 };

      await client.query(
        `INSERT INTO core.audit_log (tenant_id, actor_id, action, entity_type, entity_id, before, after)
         VALUES ($1, $2, 'platform.tenant.deleted', 'tenant', $3, $4::jsonb, $5::jsonb)`,
        [
          actorTenantId,
          actorId,
          tenantId,
          JSON.stringify(tenant),
          JSON.stringify({ reason, sessionsRevoked: sessions.rowCount ?? 0 })
        ]
      );

      return { ok: true, id: tenant.id, name: tenant.name };
    });
  }

  /**
   * Soft delete only, same rationale as deleteInstitution --
   * core.users.deleted_at already exists for exactly this, and 54
   * tables reference core.users(id) by foreign key (only 2, both
   * platform-privileged-identity tables, cascade on delete). Setting
   * status = 'suspended' alongside deleted_at is what actually blocks
   * login (auth.service.ts already rejects any non-'active' user at
   * the password check), matching how an ordinary suspension works --
   * deleted_at is what distinguishes "deleted" from "temporarily
   * suspended" for anyone reading this row later.
   *
   * The actual core.users write happens inside
   * core.platform_delete_user (0036) -- the only UPDATE policy on
   * that table is "a user can update their own row", so an ordinary
   * elimubora_app UPDATE targeting someone else's id affects zero
   * rows under RLS, silently. Sessions are revoked in the same
   * transaction for the same reason as deleteInstitution: without
   * it, a still-valid access token would keep working for up to
   * AUTH_ACCESS_TTL_SECONDS after deletion.
   */
  async deleteUser(
    actorId: string,
    actorTenantId: string,
    userId: string,
    reason: string
  ): Promise<{ id: string; fullName: string } | null> {
    return this.db.withContext({ tenantId: actorTenantId, actorId }, async (client) => {
      const result = await client.query<{ platform_delete_user: { id: string; fullName: string } | null }>(
        'SELECT core.platform_delete_user($1)',
        [userId]
      );
      const deleted = result.rows[0]?.platform_delete_user ?? null;
      if (!deleted) return null;

      const sessions = await client.query<{ id: string }>(
        `UPDATE core.refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL RETURNING id`,
        [userId]
      );

      await client.query(
        `INSERT INTO core.audit_log (tenant_id, actor_id, action, entity_type, entity_id, before, after)
         VALUES ($1, $2, 'platform.user.deleted', 'user', $3, $4::jsonb, $5::jsonb)`,
        [
          actorTenantId,
          actorId,
          userId,
          JSON.stringify(deleted),
          JSON.stringify({ reason, sessionsRevoked: sessions.rowCount ?? 0 })
        ]
      );

      return deleted;
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

import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import type { CreateGrantDto, CreateRoleDto, ImpersonationRequestDto } from './platform-access.dto';

@Injectable()
export class PlatformAccessRepository {
  constructor(private readonly db: DatabaseService) {}

  async permissions() {
    const { rows } = await this.db.query<Record<string, unknown>>(`
      SELECT id, key, description, category, requires_step_up
      FROM platform.permissions ORDER BY category, key
    `);
    return rows.map((r) => ({
      id: String(r.id), key: String(r.key), description: String(r.description), category: String(r.category),
      requiresStepUp: Boolean(r.requires_step_up)
    }));
  }

  async roles() {
    const { rows } = await this.db.query<Record<string, unknown>>(`
      SELECT r.id, r.key, r.name, r.description, r.risk_level, r.is_system,
             coalesce(array_agg(p.key ORDER BY p.key) FILTER (WHERE p.id IS NOT NULL), ARRAY[]::text[]) AS permissions
      FROM platform.roles r
      LEFT JOIN platform.role_permissions rp ON rp.role_id=r.id
      LEFT JOIN platform.permissions p ON p.id=rp.permission_id
      GROUP BY r.id ORDER BY r.is_system DESC, r.name
    `);
    return rows.map((r) => ({
      id: String(r.id), key: String(r.key), name: String(r.name), description: r.description ? String(r.description) : null,
      riskLevel: String(r.risk_level), isSystem: Boolean(r.is_system), permissions: (r.permissions ?? []) as string[]
    }));
  }

  async createRole(actorId: string, actorTenantId: string, dto: CreateRoleDto) {
    return this.db.withContext({ tenantId: actorTenantId, actorId }, async (client) => {
      const role = await client.query(`
        INSERT INTO platform.roles (key,name,description,risk_level,is_system)
        VALUES ($1,$2,$3,$4,false) RETURNING *
      `, [dto.key, dto.name, dto.description ?? null, dto.riskLevel]);
      if (dto.permissionKeys.length) {
        await client.query(`
          INSERT INTO platform.role_permissions (role_id, permission_id)
          SELECT $1, id FROM platform.permissions WHERE key = ANY($2::text[])
          ON CONFLICT DO NOTHING
        `, [role.rows[0].id, dto.permissionKeys]);
      }
      await client.query(`INSERT INTO core.audit_log (tenant_id,actor_id,action,entity_type,entity_id,after)
        VALUES ($1,$2,'platform.access.role.created','platform_role',$3,$4::jsonb)`,
        [actorTenantId, actorId, role.rows[0].id, JSON.stringify({ key: dto.key, name: dto.name, permissions: dto.permissionKeys })]);
      return role.rows[0];
    });
  }

  async updateRolePermissions(actorId: string, actorTenantId: string, roleId: string, permissionKeys: string[], reason: string) {
    return this.db.withContext({ tenantId: actorTenantId, actorId }, async (client) => {
      const before = await client.query(`SELECT r.*, coalesce(array_agg(p.key) FILTER (WHERE p.id IS NOT NULL), ARRAY[]::text[]) permissions
        FROM platform.roles r LEFT JOIN platform.role_permissions rp ON rp.role_id=r.id LEFT JOIN platform.permissions p ON p.id=rp.permission_id
        WHERE r.id=$1 GROUP BY r.id FOR UPDATE`, [roleId]);
      if (!before.rows[0]) return null;
      await client.query(`DELETE FROM platform.role_permissions WHERE role_id=$1`, [roleId]);
      if (permissionKeys.length) {
        await client.query(`INSERT INTO platform.role_permissions (role_id,permission_id)
          SELECT $1,id FROM platform.permissions WHERE key=ANY($2::text[]) ON CONFLICT DO NOTHING`, [roleId, permissionKeys]);
      }
      await client.query(`INSERT INTO core.audit_log (tenant_id,actor_id,action,entity_type,entity_id,before,after)
        VALUES ($1,$2,'platform.access.role.permissions_changed','platform_role',$3,$4::jsonb,$5::jsonb)`,
        [actorTenantId, actorId, roleId, JSON.stringify(before.rows[0]), JSON.stringify({ permissionKeys, reason })]);
      return { id: roleId, permissionKeys };
    });
  }

  async grants(limit = 100) {
    const { rows } = await this.db.query<Record<string, unknown>>(`
      SELECT g.id,g.user_id,u.full_name,u.email::text,r.key role_key,r.name role_name,
             g.scope_type,g.scope_id,g.status,g.starts_at,g.expires_at,g.reason,g.granted_by
      FROM platform.access_grants g
      JOIN core.users u ON u.id=g.user_id
      JOIN platform.roles r ON r.id=g.role_id
      ORDER BY g.created_at DESC LIMIT $1
    `, [limit]);
    return rows;
  }

  async createGrant(actorId: string, actorTenantId: string, dto: CreateGrantDto) {
    return this.db.withContext({ tenantId: actorTenantId, actorId }, async (client) => {
      const role = await client.query(`SELECT id,key,name FROM platform.roles WHERE key=$1`, [dto.roleKey]);
      if (!role.rows[0]) return null;
      const result = await client.query(`
        INSERT INTO platform.access_grants (user_id,role_id,scope_type,scope_id,expires_at,granted_by,reason)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
      `, [dto.userId, role.rows[0].id, dto.scopeType, dto.scopeId ?? null, dto.expiresAt ?? null, actorId, dto.reason]);
      await client.query(`INSERT INTO core.audit_log (tenant_id,actor_id,action,entity_type,entity_id,after)
        VALUES ($1,$2,'platform.access.grant.created','access_grant',$3,$4::jsonb)`,
        [actorTenantId, actorId, result.rows[0].id, JSON.stringify({ ...dto, roleName: role.rows[0].name })]);
      return result.rows[0];
    });
  }

  async revokeGrant(actorId: string, actorTenantId: string, grantId: string, reason: string) {
    return this.db.withContext({ tenantId: actorTenantId, actorId }, async (client) => {
      const result = await client.query(`UPDATE platform.access_grants SET status='revoked',revoked_by=$2,revoked_at=now()
        WHERE id=$1 AND status='active' RETURNING *`, [grantId, actorId]);
      if (!result.rows[0]) return null;
      await client.query(`INSERT INTO core.audit_log (tenant_id,actor_id,action,entity_type,entity_id,after)
        VALUES ($1,$2,'platform.access.grant.revoked','access_grant',$3,$4::jsonb)`,
        [actorTenantId, actorId, grantId, JSON.stringify({ reason })]);
      return result.rows[0];
    });
  }

  async privilegedSessions(limit = 100) {
    const { rows } = await this.db.query<Record<string, unknown>>(`
      SELECT s.id,s.user_id,u.full_name,u.email::text,s.assurance_level,s.verified_at,s.expires_at,s.revoked_at,s.ip,s.user_agent,s.created_at
      FROM platform.privileged_sessions s JOIN core.users u ON u.id=s.user_id
      ORDER BY s.created_at DESC LIMIT $1
    `, [limit]);
    return rows;
  }

  async revokePrivilegedSession(actorId: string, actorTenantId: string, sessionId: string, reason: string) {
    return this.db.withContext({ tenantId: actorTenantId, actorId }, async (client) => {
      const result = await client.query(`UPDATE platform.privileged_sessions SET revoked_at=now(),revoked_by=$2
        WHERE id=$1 AND revoked_at IS NULL RETURNING *`, [sessionId, actorId]);
      if (!result.rows[0]) return null;
      await client.query(`INSERT INTO core.audit_log (tenant_id,actor_id,action,entity_type,entity_id,after)
        VALUES ($1,$2,'platform.access.privileged_session.revoked','privileged_session',$3,$4::jsonb)`,
        [actorTenantId, actorId, sessionId, JSON.stringify({ reason })]);
      return result.rows[0];
    });
  }

  async impersonationRequests(limit = 100) {
    const { rows } = await this.db.query<Record<string, unknown>>(`
      SELECT i.*, actor.full_name actor_name,target.full_name target_name,t.name tenant_name
      FROM platform.impersonation_requests i
      JOIN core.users actor ON actor.id=i.actor_user_id
      JOIN core.users target ON target.id=i.target_user_id
      LEFT JOIN core.tenants t ON t.id=i.target_tenant_id
      ORDER BY i.created_at DESC LIMIT $1
    `, [limit]);
    return rows;
  }

  async createImpersonationRequest(actorId: string, actorTenantId: string, dto: ImpersonationRequestDto) {
    return this.db.withContext({ tenantId: actorTenantId, actorId }, async (client) => {
      const result = await client.query(`INSERT INTO platform.impersonation_requests
        (actor_user_id,target_user_id,target_tenant_id,reason,ticket_reference,status)
        VALUES ($1,$2,$3,$4,$5,'pending_step_up') RETURNING *`,
        [actorId, dto.targetUserId, dto.targetTenantId ?? null, dto.reason, dto.ticketReference ?? null]);
      await client.query(`INSERT INTO core.audit_log (tenant_id,actor_id,action,entity_type,entity_id,after)
        VALUES ($1,$2,'platform.access.impersonation.requested','impersonation_request',$3,$4::jsonb)`,
        [actorTenantId, actorId, result.rows[0].id, JSON.stringify({ targetUserId: dto.targetUserId, targetTenantId: dto.targetTenantId ?? null, reason: dto.reason, ticketReference: dto.ticketReference ?? null })]);
      return result.rows[0];
    });
  }

  async closeImpersonationRequest(actorId: string, actorTenantId: string, requestId: string, action: 'deny'|'end', reason: string) {
    return this.db.withContext({ tenantId: actorTenantId, actorId }, async (client) => {
      const targetStatus = action === 'deny' ? 'denied' : 'ended';
      const result = await client.query(`UPDATE platform.impersonation_requests SET status=$2,ended_at=CASE WHEN $2='ended' THEN now() ELSE ended_at END
        WHERE id=$1 AND status IN ('pending_step_up','approved','active') RETURNING *`, [requestId, targetStatus]);
      if (!result.rows[0]) return null;
      await client.query(`INSERT INTO core.audit_log (tenant_id,actor_id,action,entity_type,entity_id,after)
        VALUES ($1,$2,'platform.access.impersonation.status_changed','impersonation_request',$3,$4::jsonb)`,
        [actorTenantId, actorId, requestId, JSON.stringify({ status: targetStatus, reason })]);
      return result.rows[0];
    });
  }

  async effectivePermissions(userId: string) {
    const { rows } = await this.db.query<{ key: string }>(`
      SELECT DISTINCT p.key
      FROM platform.access_grants g
      JOIN platform.role_permissions rp ON rp.role_id=g.role_id
      JOIN platform.permissions p ON p.id=rp.permission_id
      WHERE g.user_id=$1 AND g.status='active' AND g.starts_at<=now() AND (g.expires_at IS NULL OR g.expires_at>now())
      ORDER BY p.key
    `, [userId]);
    return rows.map((r) => r.key);
  }
}

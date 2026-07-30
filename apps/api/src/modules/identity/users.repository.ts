import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import type { MembershipRole } from './identity.types';

export interface InvitationRecord {
  id: string;
  tenantId: string;
  email: string;
  role: MembershipRole;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
}

export interface TenantUserRow {
  userId: string;
  email: string;
  fullName: string;
  role: MembershipRole;
  membershipStatus: 'active' | 'suspended';
  joinedAt: Date;
}

/**
 * User-management SQL: invitations, password resets, and admin
 * operations over memberships. Tenant-scoped statements run inside
 * withTenantTransaction so RLS does the isolation.
 */
@Injectable()
export class UsersRepository {
  constructor(private readonly db: DatabaseService) {}

  // ---------------- invitations ----------------

  async createInvitation(input: {
    email: string;
    role: MembershipRole;
    invitedBy: string;
    tokenHash: string;
    ttlDays: number;
  }): Promise<string> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO core.invitations (tenant_id, email, role, invited_by, token_hash, expires_at)
         VALUES (core.current_tenant_id(), $1, $2, $3, $4, now() + make_interval(days => $5))
         RETURNING id`,
        [input.email, input.role, input.invitedBy, input.tokenHash, input.ttlDays]
      );
      const id = rows[0]!.id;
      await client.query(
        `INSERT INTO core.audit_log (tenant_id, actor_id, action, entity_type, entity_id, after)
         VALUES (core.current_tenant_id(), core.current_actor_id(), 'invitation.created',
                 'invitation', $1, jsonb_build_object('email', $2::text, 'role', $3::text))`,
        [id, input.email, input.role]
      );
      return id;
    });
  }

  async listInvitations(): Promise<InvitationRecord[]> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{
        id: string;
        tenant_id: string;
        email: string;
        role: MembershipRole;
        expires_at: Date;
        accepted_at: Date | null;
        revoked_at: Date | null;
      }>(
        `SELECT id, tenant_id, email, role, expires_at, accepted_at, revoked_at
           FROM core.invitations
          WHERE accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()
          ORDER BY created_at DESC`
      );
      return rows.map((r) => ({
        id: r.id,
        tenantId: r.tenant_id,
        email: r.email,
        role: r.role,
        expiresAt: r.expires_at,
        acceptedAt: r.accepted_at,
        revokedAt: r.revoked_at
      }));
    });
  }

  async revokeInvitation(id: string): Promise<boolean> {
    return this.db.withTenantTransaction(async (client) => {
      const res = await client.query(
        `UPDATE core.invitations SET revoked_at = now()
          WHERE id = $1 AND accepted_at IS NULL AND revoked_at IS NULL`,
        [id]
      );
      if (res.rowCount === 1) {
        await client.query(
          `INSERT INTO core.audit_log (tenant_id, actor_id, action, entity_type, entity_id)
           VALUES (core.current_tenant_id(), core.current_actor_id(),
                   'invitation.revoked', 'invitation', $1)`,
          [id]
        );
      }
      return res.rowCount === 1;
    });
  }

  /** Pre-auth lookup via SECURITY DEFINER (the acceptor has no session). */
  async findInvitationByTokenHash(tokenHash: string): Promise<InvitationRecord | null> {
    const { rows } = await this.db.query<{
      id: string;
      tenant_id: string;
      email: string;
      role: MembershipRole;
      expires_at: Date;
      accepted_at: Date | null;
      revoked_at: Date | null;
    }>('SELECT * FROM core.auth_lookup_invitation($1)', [tokenHash]);
    const r = rows[0];
    return r
      ? {
          id: r.id,
          tenantId: r.tenant_id,
          email: r.email,
          role: r.role,
          expiresAt: r.expires_at,
          acceptedAt: r.accepted_at,
          revokedAt: r.revoked_at
        }
      : null;
  }

  /**
   * Accept: create the user when new (or reuse the existing account for
   * that email), add the membership, mark the invitation — one transaction.
   */
  async acceptInvitation(input: {
    invitationId: string;
    tenantId: string;
    email: string;
    role: MembershipRole;
    existingUserId: string | null;
    fullName?: string;
    passwordHash?: string;
  }): Promise<{ userId: string; createdUser: boolean }> {
    return this.db.withContext({ tenantId: input.tenantId }, async (client) => {
      let userId = input.existingUserId;
      let createdUser = false;
      if (!userId) {
        // App-generated id — see identity.repository.createUserWithMembership.
        userId = randomUUID();
        await client.query(
          `INSERT INTO core.users (id, email, full_name, password_hash)
           VALUES ($1, $2, $3, $4)`,
          [userId, input.email, input.fullName, input.passwordHash]
        );
        createdUser = true;
      }
      await client.query(
        `INSERT INTO core.memberships (user_id, tenant_id, role)
         VALUES ($1, core.current_tenant_id(), $2)
         ON CONFLICT (user_id, tenant_id, role)
         DO UPDATE SET status = 'active', deleted_at = NULL`,
        [userId, input.role]
      );
      const marked = await client.query(
        `UPDATE core.invitations SET accepted_at = now()
          WHERE id = $1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()`,
        [input.invitationId]
      );
      if (marked.rowCount !== 1) {
        throw new Error('INVITATION_NO_LONGER_VALID');
      }
      await client.query(
        `INSERT INTO core.audit_log (tenant_id, actor_id, actor_type, action, entity_type, entity_id, after)
         VALUES (core.current_tenant_id(), $1::uuid, 'user', 'invitation.accepted', 'user', $1::text,
                 jsonb_build_object('email', $2::text, 'role', $3::text))`,
        [userId, input.email, input.role]
      );
      await client.query(
        `INSERT INTO core.outbox (tenant_id, aggregate_type, aggregate_id, event_type, payload)
         VALUES (core.current_tenant_id(), 'user', $1,
                 'membership.granted.v1',
                 jsonb_build_object('userId', $1::text, 'role', $2::text))`,
        [userId, input.role]
      );
      return { userId: userId as string, createdUser };
    });
  }

  // ---------------- admin: tenant users ----------------

  async listTenantUsers(limit: number, offset: number): Promise<TenantUserRow[]> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{
        user_id: string;
        email: string;
        full_name: string;
        role: MembershipRole;
        status: 'active' | 'suspended';
        created_at: Date;
      }>(
        `SELECT u.id AS user_id, u.email, u.full_name, m.role, m.status, m.created_at
           FROM core.memberships m
           JOIN core.users u ON u.id = m.user_id
          WHERE m.tenant_id = core.current_tenant_id()
            AND m.deleted_at IS NULL AND u.deleted_at IS NULL
          ORDER BY u.full_name
          LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      return rows.map((r) => ({
        userId: r.user_id,
        email: r.email,
        fullName: r.full_name,
        role: r.role,
        membershipStatus: r.status,
        joinedAt: r.created_at
      }));
    });
  }

  async updateMembership(
    userId: string,
    patch: { role?: MembershipRole; status?: 'active' | 'suspended' }
  ): Promise<boolean> {
    return this.db.withTenantTransaction(async (client) => {
      const before = await client.query<{ role: MembershipRole; status: string }>(
        `SELECT role, status FROM core.memberships
          WHERE user_id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL`,
        [userId]
      );
      if (before.rowCount === 0) return false;
      const res = await client.query(
        `UPDATE core.memberships
            SET role = COALESCE($2, role), status = COALESCE($3, status)
          WHERE user_id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL`,
        [userId, patch.role ?? null, patch.status ?? null]
      );
      await client.query(
        `INSERT INTO core.audit_log (tenant_id, actor_id, action, entity_type, entity_id, before, after)
         VALUES (core.current_tenant_id(), core.current_actor_id(), 'membership.updated',
                 'membership', $1, $2::jsonb, $3::jsonb)`,
        [userId, JSON.stringify(before.rows[0]), JSON.stringify(patch)]
      );
      await client.query(
        `INSERT INTO core.outbox (tenant_id, aggregate_type, aggregate_id, event_type, payload)
         VALUES (core.current_tenant_id(), 'user', $1, 'membership.updated.v1', $2::jsonb)`,
        [userId, JSON.stringify(patch)]
      );
      return (res.rowCount ?? 0) === 1;
    });
  }

  async softDeleteMembership(userId: string): Promise<boolean> {
    return this.db.withTenantTransaction(async (client) => {
      const res = await client.query(
        `UPDATE core.memberships SET deleted_at = now(), status = 'suspended'
          WHERE user_id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL`,
        [userId]
      );
      if (res.rowCount === 1) {
        await client.query(
          `INSERT INTO core.audit_log (tenant_id, actor_id, action, entity_type, entity_id)
           VALUES (core.current_tenant_id(), core.current_actor_id(),
                   'membership.removed', 'membership', $1)`,
          [userId]
        );
        await client.query(
          `INSERT INTO core.outbox (tenant_id, aggregate_type, aggregate_id, event_type, payload)
           VALUES (core.current_tenant_id(), 'user', $1, 'membership.revoked.v1',
                   jsonb_build_object('userId', $1::text))`,
          [userId]
        );
      }
      return res.rowCount === 1;
    });
  }

  // ---------------- password resets ----------------

  async createPasswordReset(input: {
    userId: string;
    tokenHash: string;
    ttlMinutes: number;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO core.password_resets (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + make_interval(mins => $3))`,
      [input.userId, input.tokenHash, input.ttlMinutes]
    );
  }

  /** Atomically consume a valid reset token; returns the user or null. */
  async consumePasswordReset(tokenHash: string): Promise<string | null> {
    const { rows } = await this.db.query<{ user_id: string }>(
      `UPDATE core.password_resets SET used_at = now()
        WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
        RETURNING user_id`,
      [tokenHash]
    );
    return rows[0]?.user_id ?? null;
  }
}

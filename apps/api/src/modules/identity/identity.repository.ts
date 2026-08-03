import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../core/database/database.service';
import type { MembershipRecord, MembershipRole, UserRecord } from './identity.types';

/** Narrow, defensive check for a Postgres unique_violation (23505) on a
 *  specific named constraint — avoids misclassifying an unrelated error
 *  that happens to also be a 23505 on some other constraint. */
function isUniqueViolation(err: unknown, constraintName: string): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: string }).code === '23505' &&
    (err as { constraint?: string }).constraint === constraintName
  );
}

interface UserRow extends Record<string, unknown> {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  status: 'active' | 'suspended';
  failed_attempts: number;
  locked_until: Date | null;
  totp_secret_enc: string | null;
  totp_enabled: boolean;
}

const toUser = (r: UserRow): UserRecord => ({
  id: r.id,
  email: r.email,
  fullName: r.full_name,
  passwordHash: r.password_hash,
  status: r.status,
  failedAttempts: r.failed_attempts,
  lockedUntil: r.locked_until,
  totpSecretEnc: r.totp_secret_enc,
  totpEnabled: r.totp_enabled
});

/**
 * All identity SQL lives here. Contract with the rest of the module:
 * user lookups are global; membership reads rely on RLS policies
 * (tenant-scoped or self-scoped via the actor binding); refresh-token
 * operations never see plaintext tokens — hashes only.
 */
@Injectable()
export class IdentityRepository {
  constructor(private readonly db: DatabaseService) {}

  /** Pre-auth lookup via SECURITY DEFINER — users is under FORCE RLS. */
  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const { rows } = await this.db.query<UserRow>(
      'SELECT * FROM core.auth_lookup_user_by_email($1)',
      [email]
    );
    return rows[0] ? toUser(rows[0]) : null;
  }

  /** Pre-auth lookup via SECURITY DEFINER — users is under FORCE RLS. */
  async findUserById(id: string): Promise<UserRecord | null> {
    const { rows } = await this.db.query<UserRow>(
      'SELECT * FROM core.auth_lookup_user_by_id($1)',
      [id]
    );
    return rows[0] ? toUser(rows[0]) : null;
  }

  /** Self-scoped read: RLS policy `memberships_self` keyed on the actor binding. */
  async listMembershipsForUser(userId: string): Promise<MembershipRecord[]> {
    return this.db.withContext({ actorId: userId }, async (client) => {
      const { rows } = await client.query<{
        tenant_id: string;
        slug: string;
        name: string;
        role: MembershipRole;
      }>(
        `SELECT m.tenant_id, t.slug, t.name, m.role
           FROM core.memberships m
           JOIN core.tenants t ON t.id = m.tenant_id
          WHERE m.user_id = $1 AND m.status = 'active' AND m.deleted_at IS NULL
            AND t.deleted_at IS NULL
          ORDER BY t.name`,
        [userId]
      );
      return rows.map((r) => ({
        tenantId: r.tenant_id,
        tenantSlug: r.slug,
        tenantName: r.name,
        role: r.role
      }));
    });
  }

  async recordLoginFailure(userId: string, lockAfter: number, lockMinutes: number): Promise<void> {
    await this.db.query('SELECT core.auth_record_login_failure($1, $2, $3)', [
      userId,
      lockAfter,
      lockMinutes
    ]);
  }

  async recordLoginSuccess(userId: string): Promise<void> {
    await this.db.query('SELECT core.auth_record_login_success($1)', [userId]);
  }

  async setPassword(userId: string, passwordHash: string): Promise<void> {
    await this.db.query('SELECT core.auth_set_password($1, $2)', [userId, passwordHash]);
  }

  /** Authenticated self-update under the users_self RLS policy. */
  async setTotpSecret(userId: string, secretEnc: string): Promise<void> {
    await this.db.withContext({ actorId: userId }, async (client) => {
      await client.query('UPDATE core.users SET totp_secret_enc = $2 WHERE id = $1', [
        userId,
        secretEnc
      ]);
    });
  }

  /** Authenticated self-update under the users_self RLS policy. */
  async enableTotp(userId: string): Promise<void> {
    await this.db.withContext({ actorId: userId }, async (client) => {
      await client.query('UPDATE core.users SET totp_enabled = true WHERE id = $1', [userId]);
    });
  }

  async createUserWithMembership(input: {
    email: string;
    fullName: string;
    passwordHash: string;
    tenantId: string;
    role: MembershipRole;
  }): Promise<string> {
    return this.db.withContext({ tenantId: input.tenantId }, async (client) => {
      // App-generated id: RLS SELECT policies apply to INSERT..RETURNING,
      // and a brand-new user is not yet visible to anyone. Client-side
      // ids are also the ADR-003 (offline-first) identifier strategy.
      const userId = randomUUID();
      try {
        await client.query(
          `INSERT INTO core.users (id, email, full_name, password_hash)
           VALUES ($1, $2, $3, $4)`,
          [userId, input.email, input.fullName, input.passwordHash]
        );
      } catch (err) {
        // 23505 = unique_violation. Caught specifically on the email
        // constraint so a genuine duplicate-registration attempt gets a
        // clean, expected 409 rather than an unhandled 500 that also
        // exposes raw Postgres error internals to the client (found via
        // Sprint 16 hardening — a duplicate-email registration attempt
        // had never been exercised against the real HTTP layer before).
        if (isUniqueViolation(err, 'users_email_key')) {
          throw new ConflictException('An account with this email already exists.');
        }
        throw err;
      }
      await client.query(
        `INSERT INTO core.memberships (user_id, tenant_id, role)
         VALUES ($1, core.current_tenant_id(), $2)`,
        [userId, input.role]
      );
      await client.query(
        `INSERT INTO core.audit_log (tenant_id, actor_id, actor_type, action, entity_type, entity_id, after)
         VALUES (core.current_tenant_id(), $1::uuid, 'user', 'user.registered', 'user', $1::text,
                 jsonb_build_object('email', $2::text, 'role', $3::text))`,
        [userId, input.email, input.role]
      );
      return userId;
    });
  }

  // ---------------- refresh token family operations ----------------

  async createRefreshToken(input: {
    familyId: string;
    userId: string;
    tenantId: string;
    role: MembershipRole;
    tokenHash: string;
    ttlDays: number;
  }): Promise<string> {
    const { rows } = await this.db.query<{ id: string }>(
      `INSERT INTO core.refresh_tokens
         (family_id, user_id, tenant_id, role, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5, now() + make_interval(days => $6))
       RETURNING id`,
      [input.familyId, input.userId, input.tenantId, input.role, input.tokenHash, input.ttlDays]
    );
    return rows[0]!.id;
  }

  async findRefreshToken(tokenHash: string): Promise<
    | {
        id: string;
        familyId: string;
        userId: string;
        tenantId: string;
        role: MembershipRole;
        expiresAt: Date;
        revokedAt: Date | null;
      }
    | null
  > {
    const { rows } = await this.db.query<{
      id: string;
      family_id: string;
      user_id: string;
      tenant_id: string;
      role: MembershipRole;
      expires_at: Date;
      revoked_at: Date | null;
    }>(
      `SELECT id, family_id, user_id, tenant_id, role, expires_at, revoked_at
         FROM core.refresh_tokens WHERE token_hash = $1`,
      [tokenHash]
    );
    const r = rows[0];
    return r
      ? {
          id: r.id,
          familyId: r.family_id,
          userId: r.user_id,
          tenantId: r.tenant_id,
          role: r.role,
          expiresAt: r.expires_at,
          revokedAt: r.revoked_at
        }
      : null;
  }

  async rotateRefreshToken(oldId: string, replacedBy: string): Promise<void> {
    await this.db.query(
      'UPDATE core.refresh_tokens SET revoked_at = now(), replaced_by = $2 WHERE id = $1',
      [oldId, replacedBy]
    );
  }

  /** Theft response: kill every token in the session's family. */
  async revokeFamily(familyId: string): Promise<void> {
    await this.db.query(
      'UPDATE core.refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL',
      [familyId]
    );
  }

  /** Password reset / account suspension: kill every session. */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.db.query(
      'UPDATE core.refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
      [userId]
    );
  }
}

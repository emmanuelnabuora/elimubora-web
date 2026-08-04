import { ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PasswordService } from '../auth/password.service';
import { DatabaseService } from '../database/database.service';
import type { CreateTenantDto } from './tenant-provisioning.dto';

function isUniqueViolation(err: unknown, constraintName: string): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: string }).code === '23505' &&
    (err as { constraint?: string }).constraint === constraintName
  );
}

export interface ProvisionedTenant {
  tenantId: string;
  adminUserId: string;
}

/**
 * Real school onboarding: creates a new tenant and its first admin
 * user together, so the resulting account can log in immediately
 * rather than needing a separate invitation step.
 *
 * Everything happens inside ONE withContext({tenantId, actorId})
 * transaction, tenant row included — a genuine correctness point, not
 * a style choice. core.tenants itself has no RLS (nothing scopes it
 * to a tenant; it IS the tenant table), so nothing requires the
 * tenant insert to run separately from the tenant-bound one — and
 * running them separately would mean a failure creating the admin
 * user (e.g. a duplicate email) leaves a real, orphaned tenant behind
 * with no admin, silently, since the first insert would already have
 * committed. Same partial-failure class as the guardian-linking
 * orchestration route built earlier — worth actually avoiding here
 * rather than repeating, since the fix costs nothing (Postgres allows
 * setting app.tenant_id via set_config before the row it references
 * exists; the FK is only checked when core.memberships is written,
 * later in the same transaction, by which point the tenant row is
 * already there).
 */
@Injectable()
export class TenantProvisioningService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly passwords: PasswordService
  ) {}

  async createSchoolTenant(actor: AuthenticatedUser, dto: CreateTenantDto): Promise<ProvisionedTenant> {
    const passwordHash = await this.passwords.hash(dto.adminPassword);
    const tenantId = randomUUID();
    const adminUserId = randomUUID();

    try {
      await this.db.withContext({ tenantId, actorId: actor.userId }, async (client) => {
        await client.query(
          `INSERT INTO core.tenants (id, slug, name, kind, county_code) VALUES ($1, $2, $3, $4, $5)`,
          [tenantId, dto.slug, dto.name, dto.kind, dto.countyCode ?? null]
        );
        await client.query(
          `INSERT INTO core.users (id, email, full_name, password_hash) VALUES ($1, $2, $3, $4)`,
          [adminUserId, dto.adminEmail.trim().toLowerCase(), dto.adminFullName, passwordHash]
        );
        await client.query(
          `INSERT INTO core.memberships (user_id, tenant_id, role, status)
           VALUES ($1, core.current_tenant_id(), 'school_admin', 'active')`,
          [adminUserId]
        );
        await this.audit.record(client, {
          action: 'tenant.onboarded',
          entityType: 'tenant',
          entityId: tenantId,
          after: { name: dto.name, slug: dto.slug, kind: dto.kind, adminEmail: dto.adminEmail }
        });
      });
    } catch (err) {
      if (isUniqueViolation(err, 'tenants_slug_key')) {
        throw new ConflictException(`A school with the slug "${dto.slug}" already exists.`);
      }
      if (isUniqueViolation(err, 'users_email_key')) {
        throw new ConflictException('An account with this email already exists.');
      }
      throw err;
    }

    return { tenantId, adminUserId };
  }
}

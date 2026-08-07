import { ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PasswordService } from '../auth/password.service';
import { DatabaseService } from '../database/database.service';
import type { CreateTenantDto, UpdateTenantLogoDto } from './tenant-provisioning.dto';

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
  adminRole: string;
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

    // Real gap found while building the government dashboard's live
    // verification: this used to be hardcoded to 'school_admin'
    // regardless of dto.kind, so onboarding a county or ministry
    // tenant through this endpoint would still create a school_admin
    // for it — wrong role for that tenant kind, and that account
    // wouldn't actually satisfy the government module's own
    // READ_ROLES/REFRESH_ROLES checks. university/tvet/partner have
    // no dedicated membership role in the system yet; school_admin
    // remains the closest fit for those until one exists — a
    // documented simplification, not an oversight.
    const roleForKind: Record<string, string> = {
      county: 'county_officer',
      ministry: 'ministry_official'
    };
    const adminRole = roleForKind[dto.kind] ?? 'school_admin';

    try {
      await this.db.withContext({ tenantId, actorId: actor.userId }, async (client) => {
        const settings = {
          institution: {
            shortName: dto.shortName ?? null,
            registrationNumber: dto.registrationNumber ?? null,
            educationLevel: dto.educationLevel ?? null,
            ownership: dto.ownership ?? null,
            yearEstablished: dto.yearEstablished ?? null,
            motto: dto.motto ?? null
          },
          location: {
            subCounty: dto.subCounty ?? null,
            ward: dto.ward ?? null,
            physicalAddress: dto.physicalAddress ?? null
          },
          contacts: dto.contacts ?? [],
          facilities: dto.facilities ?? [],
          technology: dto.technology ?? null,
          finance: dto.finance ?? null,
          branding: dto.branding ?? null,
          migration: {
            method: dto.migrationMethod ?? null,
            notes: dto.migrationNotes ?? null
          }
        };
        await client.query(
          `INSERT INTO core.tenants (id, slug, name, kind, county_code, settings) VALUES ($1, $2, $3, $4, $5, $6)`,
          [tenantId, dto.slug, dto.name, dto.kind, dto.countyCode ?? null, JSON.stringify(settings)]
        );
        await client.query(
          `INSERT INTO core.users (id, email, full_name, password_hash) VALUES ($1, $2, $3, $4)`,
          [adminUserId, dto.adminEmail.trim().toLowerCase(), dto.adminFullName, passwordHash]
        );
        await client.query(
          `INSERT INTO core.memberships (user_id, tenant_id, role, status)
           VALUES ($1, core.current_tenant_id(), $2, 'active')`,
          [adminUserId, adminRole]
        );

        // The one genuinely functional addition here: a real class
        // stream for every grade x stream combination, so a newly
        // onboarded school doesn't hit the "no class exists yet"
        // dead end that blocked enrollment repeatedly before class
        // creation had a UI at all. Both fields are optional — a
        // school can still onboard with zero classes, same as before.
        let classesCreated = 0;
        if (dto.gradeLevels?.length && dto.streams?.length && dto.academicYear) {
          for (const grade of dto.gradeLevels) {
            for (const stream of dto.streams) {
              await client.query(
                `INSERT INTO sis.class_streams (id, tenant_id, name, grade_level, academic_year)
                 VALUES ($1, core.current_tenant_id(), $2, $3, $4)`,
                [randomUUID(), `${grade} ${stream}`, grade, dto.academicYear]
              );
              classesCreated += 1;
            }
          }
        }

        await this.audit.record(client, {
          action: 'tenant.onboarded',
          entityType: 'tenant',
          entityId: tenantId,
          after: { name: dto.name, slug: dto.slug, kind: dto.kind, adminEmail: dto.adminEmail, classesCreated }
        });
      });
    } catch (err) {
      if (isUniqueViolation(err, 'tenants_slug_key')) {
        throw new ConflictException(`A school with the slug "${dto.slug}" already exists.`);
      }
      if (isUniqueViolation(err, 'users_email_key')) {
        throw new ConflictException('An account with this email already exists.');
      }
      if (isUniqueViolation(err, 'class_streams_tenant_id_name_academic_year_key')) {
        throw new ConflictException(
          'One of the grade/stream combinations produces a duplicate class name for this academic year.'
        );
      }
      throw err;
    }

    return { tenantId, adminUserId, adminRole };
  }

  /**
   * Returns the caller's own active tenant -- name and logo, for
   * display in the sidebar/header and the school settings page.
   * Deliberately open to any authenticated staff role (not just
   * admins) at the controller level, since every role in the app
   * needs to see the school's own logo, even though only admins can
   * change it.
   */
  async getCurrentTenant(
    user: AuthenticatedUser
  ): Promise<{ id: string; name: string; slug: string; logoDataUrl: string | null }> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{ id: string; name: string; slug: string; logo_data_url: string | null }>(
        `SELECT id, name, slug, logo_data_url FROM core.tenants WHERE id = core.current_tenant_id()`
      );
      const r = rows[0]!;
      return { id: r.id, name: r.name, slug: r.slug, logoDataUrl: r.logo_data_url };
    });
  }

  /**
   * Every other school in the platform, for picking a transfer
   * destination. core.tenants has no RLS at all (relrowsecurity is
   * false) -- deliberately, since it's the root directory table other
   * tenant-scoped RLS policies themselves need to join against, so
   * this is a plain query, not a tenant-scoped one like every other
   * method in this file. Excludes the caller's own tenant (matching
   * the DB check constraint that a transfer's to_tenant_id can't
   * equal its from_tenant_id) and non-school tenant kinds (ministry,
   * platform) -- neither is a valid transfer destination.
   *
   * Optional `search` parameter, not just a bigger LIMIT: found the
   * real problem the hard way, via a failing test rather than a
   * hunch. A fixed alphabetical top-200 slice works fine at small
   * scale, but once a platform has enough schools, a school whose
   * name happens to sort past position 200 becomes permanently
   * impossible to select at all -- discovered directly when a freshly
   * created test school didn't appear in this sandbox's (heavily
   * test-polluted) results. A search-and-filter parameter is the
   * actual fix; the LIMIT is a safety bound on an unfiltered browse,
   * not the primary way of finding a specific school.
   */
  async listSchools(user: AuthenticatedUser, search?: string): Promise<Array<{ id: string; name: string }>> {
    const { rows } = await this.db.withTenantTransaction(async (client) =>
      client.query<{ id: string; name: string }>(
        search
          ? `SELECT id, name FROM core.tenants WHERE kind = 'school' AND id != $1 AND name ILIKE $2 ORDER BY name LIMIT 200`
          : `SELECT id, name FROM core.tenants WHERE kind = 'school' AND id != $1 ORDER BY name LIMIT 200`,
        search ? [user.tenantId, `%${search}%`] : [user.tenantId]
      )
    );
    return rows;
  }

  /**
   * Updates the caller's own active tenant's logo. Restricted to
   * admin roles at the controller level -- unlike getCurrentTenant,
   * this one actually changes something.
   */
  async updateTenantLogo(user: AuthenticatedUser, dto: UpdateTenantLogoDto): Promise<{ logoDataUrl: string }> {
    return this.db.withTenantTransaction(async (client) => {
      await client.query(`UPDATE core.tenants SET logo_data_url = $1 WHERE id = core.current_tenant_id()`, [
        dto.logoDataUrl
      ]);
      await this.audit.record(client, {
        action: 'tenant.logo_updated',
        entityType: 'tenant',
        entityId: user.tenantId,
        after: { updatedBy: user.userId }
      });
      return { logoDataUrl: dto.logoDataUrl };
    });
  }
}

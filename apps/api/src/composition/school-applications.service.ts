import { randomBytes, randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/configuration';
import { AuditService } from '../core/audit/audit.service';
import type { AuthenticatedUser } from '../core/auth/auth.types';
import { DatabaseService } from '../core/database/database.service';
import {
  NOTIFICATION_CHANNEL,
  type NotificationChannel
} from '../core/notifications/notification';
import { TokenService } from '../modules/identity/token.service';
import type {
  ApproveSchoolApplicationDto,
  RejectSchoolApplicationDto,
  SubmitSchoolApplicationDto
} from './school-applications.dto';

function isUniqueViolation(err: unknown, constraintName: string): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: string }).code === '23505' &&
    (err as { constraint?: string }).constraint === constraintName
  );
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

export interface SchoolApplicationSummary {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  schoolName: string;
  countyCode: string | null;
  adminFullName: string;
  adminEmail: string;
  submittedAt: Date;
  reviewedAt: Date | null;
}

export interface SchoolApplicationDetail extends SchoolApplicationSummary {
  subCounty: string | null;
  ward: string | null;
  physicalAddress: string | null;
  shortName: string | null;
  registrationNumber: string | null;
  educationLevel: string | null;
  ownership: string | null;
  yearEstablished: string | null;
  motto: string | null;
  adminPhone: string | null;
  contacts: Array<Record<string, unknown>>;
  academicYear: number | null;
  gradeLevels: string[] | null;
  streams: string[] | null;
  notes: string | null;
  rejectionReason: string | null;
  resultingTenantId: string | null;
}

interface ApplicationRow extends Record<string, unknown> {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  school_name: string;
  county_code: string | null;
  sub_county: string | null;
  ward: string | null;
  physical_address: string | null;
  short_name: string | null;
  registration_number: string | null;
  education_level: string | null;
  ownership: string | null;
  year_established: string | null;
  motto: string | null;
  admin_full_name: string;
  admin_email: string;
  admin_phone: string | null;
  contacts: Array<Record<string, unknown>>;
  academic_year: number | null;
  grade_levels: string[] | null;
  streams: string[] | null;
  notes: string | null;
  submitted_at: Date;
  reviewed_at: Date | null;
  rejection_reason: string | null;
  resulting_tenant_id: string | null;
}

function mapRow(r: ApplicationRow): SchoolApplicationDetail {
  return {
    id: r.id,
    status: r.status,
    schoolName: r.school_name,
    countyCode: r.county_code,
    subCounty: r.sub_county,
    ward: r.ward,
    physicalAddress: r.physical_address,
    shortName: r.short_name,
    registrationNumber: r.registration_number,
    educationLevel: r.education_level,
    ownership: r.ownership,
    yearEstablished: r.year_established,
    motto: r.motto,
    adminFullName: r.admin_full_name,
    adminEmail: r.admin_email,
    adminPhone: r.admin_phone,
    contacts: r.contacts ?? [],
    academicYear: r.academic_year,
    gradeLevels: r.grade_levels,
    streams: r.streams,
    notes: r.notes,
    submittedAt: r.submitted_at,
    reviewedAt: r.reviewed_at,
    rejectionReason: r.rejection_reason,
    resultingTenantId: r.resulting_tenant_id
  };
}

/**
 * Self-serve school onboarding, gated by review. Lives in composition
 * (not core/tenancy) for the same reason GuardianInvitationsController
 * does: approving an application genuinely needs both tenancy (create
 * the tenant) and identity (create the admin's invitation) together,
 * in one transaction, which neither module can do reaching into the
 * other directly.
 *
 * core.school_applications has no RLS (see 0035_school_applications.sql)
 * — every query here is DatabaseService.query(), the existing
 * "untenanted query, for global tables" method, exactly like
 * TenantProvisioningService.listSchools already does against
 * core.tenants for the same structural reason.
 */
@Injectable()
export class SchoolApplicationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(NOTIFICATION_CHANNEL) private readonly notifications: NotificationChannel
  ) {}

  /**
   * Public submission. No account, no password — just a record and a
   * token the applicant can use to check on it later. The status
   * token is hashed before storage the same way invitation tokens are
   * (TokenService.hashRefreshToken), so a leaked database row never
   * hands out a usable secret.
   */
  async submit(dto: SubmitSchoolApplicationDto): Promise<{ id: string; statusUrl?: string }> {
    const statusToken = randomBytes(32).toString('base64url');
    const statusTokenHash = TokenService.hashRefreshToken(statusToken);
    const id = randomUUID();

    // No tenant exists yet, so this is a plain, untenanted insert —
    // db.withContext({}) rather than withTenantTransaction, purely so
    // the audit entry below can still go through the normal
    // AuditService.record() helper with tenant_id/actor_id both NULL
    // (core.current_tenant_id()/current_actor_id() are NULL-safe when
    // no app.tenant_id/app.actor_id GUC is bound — see 0001_foundation.sql).
    await this.db.withContext({}, async (client) => {
      await client.query(
        `INSERT INTO core.school_applications
           (id, school_name, county_code, sub_county, ward, physical_address,
            short_name, registration_number, education_level, ownership,
            year_established, motto, admin_full_name, admin_email, admin_phone,
            contacts, academic_year, grade_levels, streams, notes, status_token_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
                 $16::jsonb, $17, $18, $19, $20, $21)`,
        [
          id,
          dto.schoolName,
          dto.countyCode ?? null,
          dto.subCounty ?? null,
          dto.ward ?? null,
          dto.physicalAddress ?? null,
          dto.shortName ?? null,
          dto.registrationNumber ?? null,
          dto.educationLevel ?? null,
          dto.ownership ?? null,
          dto.yearEstablished ?? null,
          dto.motto ?? null,
          dto.adminFullName,
          dto.adminEmail.trim().toLowerCase(),
          dto.adminPhone ?? null,
          JSON.stringify(dto.contacts ?? []),
          dto.academicYear ?? null,
          dto.gradeLevels ?? null,
          dto.streams ?? null,
          dto.notes ?? null,
          statusTokenHash
        ]
      );
      await this.audit.record(client, {
        action: 'school_application.submitted',
        entityType: 'school_application',
        entityId: id,
        after: { schoolName: dto.schoolName, adminEmail: dto.adminEmail },
        actorType: 'system'
      });
    });

    const statusUrl = `${this.config.publicWebUrl}/apply/status?token=${statusToken}`;
    await this.notifications.deliver({
      to: { email: dto.adminEmail },
      template: 'school-application-received',
      data: { schoolName: dto.schoolName, statusUrl }
    });

    return this.config.nodeEnv === 'production' ? { id } : { id, statusUrl };
  }

  /** Public, token-based — no login needed to see where an application stands. */
  async checkStatus(token: string): Promise<{
    status: 'pending' | 'approved' | 'rejected';
    schoolName: string;
    submittedAt: Date;
    reviewedAt: Date | null;
    rejectionReason: string | null;
  }> {
    const tokenHash = TokenService.hashRefreshToken(token);
    const { rows } = await this.db.query<ApplicationRow>(
      `SELECT status, school_name, submitted_at, reviewed_at, rejection_reason
         FROM core.school_applications WHERE status_token_hash = $1`,
      [tokenHash]
    );
    const r = rows[0];
    if (!r) throw new NotFoundException('No application found for this link.');
    return {
      status: r.status,
      schoolName: r.school_name,
      submittedAt: r.submitted_at,
      reviewedAt: r.reviewed_at,
      rejectionReason: r.rejection_reason
    };
  }

  /** platform_admin only — enforced at the controller via @Roles(). */
  async list(status?: 'pending' | 'approved' | 'rejected'): Promise<SchoolApplicationSummary[]> {
    const { rows } = await this.db.query<ApplicationRow>(
      status
        ? `SELECT * FROM core.school_applications WHERE status = $1 ORDER BY submitted_at DESC`
        : `SELECT * FROM core.school_applications ORDER BY submitted_at DESC`,
      status ? [status] : []
    );
    return rows.map(mapRow);
  }

  async getById(id: string): Promise<SchoolApplicationDetail> {
    const { rows } = await this.db.query<ApplicationRow>(
      `SELECT * FROM core.school_applications WHERE id = $1`,
      [id]
    );
    const r = rows[0];
    if (!r) throw new NotFoundException('Application not found');
    return mapRow(r);
  }

  /**
   * Creates the tenant and sends the admin a normal invitation — it
   * does NOT create the admin's user account or password directly.
   * That happens later, through the same accept-invitation flow every
   * other invited user (teachers, guardians) already goes through,
   * unmodified. This is deliberate: a tenant with a real admin only
   * comes into existence once someone has actually accepted, exactly
   * the same "pending invitation" state the staff-invite UI already
   * shows as normal, not a new concept for this codebase.
   *
   * Everything — tenant insert, optional class streams, the
   * invitation itself, both audit entries, and marking the
   * application approved — happens in ONE transaction bound to the
   * new tenant's id, for the same reason
   * TenantProvisioningService.createSchoolTenant does: a failure
   * partway through (e.g. a duplicate slug) must not leave an
   * orphaned tenant, or an application stuck claiming a tenant that
   * doesn't fully exist.
   */
  async approve(
    actor: AuthenticatedUser,
    id: string,
    dto: ApproveSchoolApplicationDto
  ): Promise<{ tenantId: string; acceptUrl?: string }> {
    const application = await this.getById(id);
    if (application.status !== 'pending') {
      throw new ConflictException(`This application is already ${application.status}.`);
    }

    const tenantId = randomUUID();
    const slug = dto.slug ?? slugify(application.schoolName);
    const inviteToken = randomBytes(32).toString('base64url');
    const inviteTokenHash = TokenService.hashRefreshToken(inviteToken);
    let classesCreated = 0;

    try {
      await this.db.withContext({ tenantId, actorId: actor.userId }, async (client) => {
        const settings = {
          institution: {
            shortName: application.shortName,
            registrationNumber: application.registrationNumber,
            educationLevel: application.educationLevel,
            ownership: application.ownership,
            yearEstablished: application.yearEstablished,
            motto: application.motto
          },
          location: {
            subCounty: application.subCounty,
            ward: application.ward,
            physicalAddress: application.physicalAddress
          },
          contacts: application.contacts,
          application: { sourceApplicationId: id, notes: application.notes }
        };
        await client.query(
          `INSERT INTO core.tenants (id, slug, name, kind, county_code, settings)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [tenantId, slug, application.schoolName, dto.kind, application.countyCode, JSON.stringify(settings)]
        );

        if (application.gradeLevels?.length && application.streams?.length && application.academicYear) {
          for (const grade of application.gradeLevels) {
            for (const stream of application.streams) {
              const { rowCount } = await client.query(
                `INSERT INTO sis.class_streams (id, tenant_id, name, grade_level, academic_year)
                 VALUES ($1, core.current_tenant_id(), $2, $3, $4)
                 ON CONFLICT (tenant_id, name, academic_year) DO NOTHING`,
                [randomUUID(), `${grade} ${stream}`, grade, application.academicYear]
              );
              if (rowCount) classesCreated += 1;
            }
          }
        }

        await client.query(
          `INSERT INTO core.invitations (tenant_id, email, role, invited_by, token_hash, expires_at)
           VALUES (core.current_tenant_id(), $1, 'school_admin', $2, $3,
                   now() + make_interval(days => $4))`,
          [application.adminEmail, actor.userId, inviteTokenHash, this.config.auth.invitationTtlDays]
        );

        await client.query(
          `UPDATE core.school_applications
             SET status = 'approved', reviewed_at = now(), reviewed_by = $1, resulting_tenant_id = $2
           WHERE id = $3`,
          [actor.userId, tenantId, id]
        );

        await this.audit.record(client, {
          action: 'school_application.approved',
          entityType: 'school_application',
          entityId: id,
          after: { schoolName: application.schoolName, tenantId, slug, classesCreated }
        });
        await this.audit.record(client, {
          action: 'tenant.onboarded',
          entityType: 'tenant',
          entityId: tenantId,
          after: {
            name: application.schoolName,
            slug,
            kind: dto.kind,
            adminEmail: application.adminEmail,
            classesCreated,
            pendingAdminInvite: true,
            sourceApplicationId: id
          }
        });
      });
    } catch (err) {
      if (isUniqueViolation(err, 'tenants_slug_key')) {
        throw new ConflictException(`A school with the slug "${slug}" already exists. Choose a different slug.`);
      }
      if (isUniqueViolation(err, 'class_streams_tenant_id_name_academic_year_key')) {
        throw new ConflictException(
          'This application lists duplicate stream names for the same grade and academic year. Please correct the application and try again.'
        );
      }
      throw err;
    }

    const acceptUrl = `${this.config.publicWebUrl}/invitations/accept?token=${inviteToken}`;
    await this.notifications.deliver({
      to: { email: application.adminEmail },
      template: 'school-application-approved',
      data: { schoolName: application.schoolName, acceptUrl, role: 'school_admin', classesCreated }
    });

    return { tenantId };
  }

  async reject(actor: AuthenticatedUser, id: string, dto: RejectSchoolApplicationDto): Promise<void> {
    const application = await this.getById(id);
    if (application.status !== 'pending') {
      throw new ConflictException(`This application is already ${application.status}.`);
    }

    await this.db.withContext({ actorId: actor.userId }, async (client) => {
      await client.query(
        `UPDATE core.school_applications
           SET status = 'rejected', reviewed_at = now(), reviewed_by = $1, rejection_reason = $2
         WHERE id = $3`,
        [actor.userId, dto.reason, id]
      );
      await this.audit.record(client, {
        action: 'school_application.rejected',
        entityType: 'school_application',
        entityId: id,
        after: { schoolName: application.schoolName, reason: dto.reason },
        actorType: 'user'
      });
    });

    await this.notifications.deliver({
      to: { email: application.adminEmail },
      template: 'school-application-rejected',
      data: { schoolName: application.schoolName, reason: dto.reason }
    });
  }

  /**
   * For an already-approved application whose admin never got (or
   * lost, or let expire) their invitation email. Deliberately not
   * the same code path as the generic PATCH
   * /v1/users/invitations/:id/resend (UsersRepository.resendInvitation):
   * that one runs under the CALLING user's own ambient tenant via
   * withTenantTransaction, which for a platform_admin is the
   * 'platform' tenant, not the school's -- RLS on core.invitations
   * (invitations_tenant: tenant_id = core.current_tenant_id()) would
   * silently match zero rows rather than erroring, since the
   * invitation genuinely exists, just under a tenant the caller's
   * ambient context doesn't have. This method explicitly binds the
   * school's own resultingTenantId via db.withContext, the same way
   * approve() does for the original insert.
   *
   * Also deliberately more permissive than the generic resend's SQL:
   * that one requires expires_at > now(), because it's meant for a
   * still-valid invite that bounced. Here, an already-expired link is
   * the expected reason someone is clicking this button, so expiry is
   * not part of the WHERE clause -- only accepted_at IS NULL is,
   * since an accepted invitation means the admin already has a real
   * account and resending would be pointless (and confusing).
   */
  async resendInvitation(actor: AuthenticatedUser, id: string): Promise<void> {
    const application = await this.getById(id);
    if (application.status !== 'approved' || !application.resultingTenantId) {
      throw new ConflictException('This application has not been approved, so there is no invitation to resend.');
    }

    const inviteToken = randomBytes(32).toString('base64url');
    const inviteTokenHash = TokenService.hashRefreshToken(inviteToken);

    const outcome = await this.db.withContext(
      { tenantId: application.resultingTenantId, actorId: actor.userId },
      async (client) => {
        const { rows } = await client.query<{ id: string; accepted_at: Date | null }>(
          `SELECT id, accepted_at FROM core.invitations
            WHERE tenant_id = core.current_tenant_id()
              AND email = $1
              AND role = 'school_admin'
            ORDER BY created_at DESC
            LIMIT 1`,
          [application.adminEmail]
        );
        const invitation = rows[0];
        if (!invitation) return 'missing' as const;
        if (invitation.accepted_at) return 'already-accepted' as const;

        await client.query(
          `UPDATE core.invitations
              SET token_hash = $2, expires_at = now() + make_interval(days => $3), revoked_at = NULL
            WHERE id = $1`,
          [invitation.id, inviteTokenHash, this.config.auth.invitationTtlDays]
        );
        await this.audit.record(client, {
          action: 'invitation.resent',
          entityType: 'invitation',
          entityId: invitation.id,
          after: { schoolApplicationId: id, adminEmail: application.adminEmail },
          actorType: 'user'
        });
        return 'resent' as const;
      }
    );

    if (outcome === 'missing') {
      // Shouldn't happen -- approve() always creates one -- but a
      // clear message beats a confusing generic 404 if it somehow did.
      throw new NotFoundException('No invitation found for this application. It may need to be re-approved.');
    }
    if (outcome === 'already-accepted') {
      throw new ConflictException(`${application.adminFullName} has already completed account setup.`);
    }

    const acceptUrl = `${this.config.publicWebUrl}/invitations/accept?token=${inviteToken}`;
    await this.notifications.deliver({
      to: { email: application.adminEmail },
      template: 'school-application-approved',
      data: { schoolName: application.schoolName, role: 'school_admin', acceptUrl }
    });
  }
}

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { GovernmentRepository } from './government.repository';
import type { AttendanceSnapshot, EnrollmentSnapshot } from './government.types';

const REFRESH_ROLES = new Set(['ministry_official', 'platform_admin']);
const READ_ROLES = new Set(['county_officer', 'ministry_official', 'platform_admin']);

/**
 * Authorization here is genuinely different from every prior module:
 * it's not tenant-scoped RLS (these tables have no tenant_id), it's
 * ROLE- and COUNTY-scoped against the requester's own tenant record.
 * A county_officer's tenant (kind='county') carries the county_code
 * that bounds every query they're allowed to make — they cannot
 * request a different county's data or the national rollup, and
 * cannot trigger a refresh (an administrative/ministry action).
 */
@Injectable()
export class GovernmentService {
  constructor(private readonly repo: GovernmentRepository) {}

  private requireRefreshRole(user: AuthenticatedUser): void {
    if (!REFRESH_ROLES.has(user.role)) {
      throw new ForbiddenException('Only ministry officials can refresh national statistics');
    }
  }

  /**
   * Resolves the effective county scope for a read: a county_officer
   * is always forced to their own county regardless of what they ask
   * for; ministry_official/platform_admin may request any county or
   * omit it for the national rollup.
   */
  private async resolveCountyScope(
    user: AuthenticatedUser,
    requestedCountyCode?: string
  ): Promise<string | null> {
    if (!READ_ROLES.has(user.role)) {
      throw new ForbiddenException('This dashboard is restricted to government and ministry roles');
    }
    if (user.role === 'county_officer') {
      const scope = await this.repo.findTenantScope(user.tenantId);
      if (!scope || scope.kind !== 'county' || !scope.countyCode) {
        throw new ForbiddenException('Your account is not associated with a county');
      }
      return scope.countyCode;
    }
    return requestedCountyCode ?? null;
  }

  async refreshEnrollment(user: AuthenticatedUser, academicYear: number): Promise<void> {
    this.requireRefreshRole(user);
    await this.repo.refreshEnrollment(academicYear);
  }

  async refreshAttendance(user: AuthenticatedUser, academicYear: number): Promise<void> {
    this.requireRefreshRole(user);
    await this.repo.refreshAttendance(academicYear);
  }

  async getEnrollment(
    user: AuthenticatedUser,
    academicYear: number,
    requestedCountyCode?: string
  ): Promise<EnrollmentSnapshot> {
    const countyCode = await this.resolveCountyScope(user, requestedCountyCode);
    const snapshot = await this.repo.findLatestEnrollment(academicYear, countyCode);
    if (!snapshot) {
      throw new NotFoundException(
        'No enrollment snapshot available for this year/county — has it been refreshed?'
      );
    }
    return snapshot;
  }

  async getAttendance(
    user: AuthenticatedUser,
    academicYear: number,
    requestedCountyCode?: string
  ): Promise<AttendanceSnapshot> {
    const countyCode = await this.resolveCountyScope(user, requestedCountyCode);
    const snapshot = await this.repo.findLatestAttendance(academicYear, countyCode);
    if (!snapshot) {
      throw new NotFoundException(
        'No attendance snapshot available for this year/county — has it been refreshed?'
      );
    }
    return snapshot;
  }

  /** National view only — every county's latest figures side by side. */
  async listEnrollmentByCounty(
    user: AuthenticatedUser,
    academicYear: number
  ): Promise<EnrollmentSnapshot[]> {
    if (user.role === 'county_officer') {
      throw new ForbiddenException('The national breakdown is restricted to ministry roles');
    }
    if (!READ_ROLES.has(user.role)) {
      throw new ForbiddenException('This dashboard is restricted to government and ministry roles');
    }
    return this.repo.listLatestEnrollmentByCounty(academicYear);
  }
}

import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../core/auth/decorators';
import type { AuthenticatedUser } from '../core/auth/auth.types';
import { CommsRepository } from '../modules/comms/comms.repository';
import { SisRepository } from '../modules/sis/sis.repository';

const STAFF_ROLES = new Set(['teacher', 'school_admin', 'principal', 'platform_admin']);

/**
 * A real gap this closes: comms.controller.ts only ever had POST
 * (staff posting an announcement). The only way to READ one was
 * ParentPortalController's guardian-specific composed view — a
 * teacher, admin, or student had no way to read announcements at all.
 * Lives in composition (not the comms module itself) because the
 * learner case genuinely needs SIS (to resolve their own grade level)
 * crossing a module boundary comms can't cross on its own. Parents
 * keep using their existing, separately-tested
 * GET /parent-portal/announcements — this endpoint deliberately
 * doesn't try to also cover that case, to avoid duplicating an
 * already-correct path.
 */
@Controller('announcements')
export class AnnouncementsReadController {
  constructor(
    private readonly comms: CommsRepository,
    private readonly sis: SisRepository
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    if (STAFF_ROLES.has(user.role)) {
      return this.comms.listAll();
    }
    if (user.role === 'learner') {
      const profile = await this.sis.getMyProfile(user.userId);
      const gradeLevel = profile?.gradeLevel;
      return this.comms.listForGradeLevels(gradeLevel ? [gradeLevel] : []);
    }
    // Parents have their own, already-correct path
    // (GET /parent-portal/announcements, aggregated across every
    // linked child's grade) — sending them here would mean either
    // reimplementing that aggregation or giving them an incomplete
    // whole-school-only view, neither of which is better than the
    // endpoint they already use.
    return [];
  }
}

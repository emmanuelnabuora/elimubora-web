import { Controller, ForbiddenException, Get, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
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
      return this.comms.listForGradeLevels(gradeLevel ? [gradeLevel] : [], 'students');
    }
    // Parents have their own, already-correct path
    // (GET /parent-portal/announcements, aggregated across every
    // linked child's grade) — sending them here would mean either
    // reimplementing that aggregation or giving them an incomplete
    // whole-school-only view, neither of which is better than the
    // endpoint they already use.
    return [];
  }

  /**
   * The detail view a notification email (or a click from any list)
   * deep-links to. Reuses this controller's existing role split
   * rather than introducing a second one: staff can view anything at
   * their school regardless of targeting (the same oversight already
   * implicit in listAll not being grade-filtered); a learner or
   * parent only if the announcement's grade and audience targeting
   * actually reaches them — checked against the same SIS-derived
   * grade level(s) their own list view already uses, not a separate,
   * potentially divergent notion of "can they see this."
   */
  @Get(':id')
  async getOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    const announcement = await this.comms.findById(id);
    if (!announcement) throw new NotFoundException('Announcement not found');

    if (STAFF_ROLES.has(user.role)) return announcement;

    if (user.role === 'learner') {
      const profile = await this.sis.getMyProfile(user.userId);
      const matchesGrade = !announcement.gradeLevel || announcement.gradeLevel === profile?.gradeLevel;
      if (announcement.targetStudents && matchesGrade) return announcement;
      throw new ForbiddenException('This announcement is not visible to you');
    }

    if (user.role === 'parent') {
      const children = await this.sis.listChildrenForGuardianUser(user.userId);
      const gradeLevels = new Set<string>();
      for (const child of children) {
        const level = await this.sis.getCurrentGradeLevel(child.studentId);
        if (level) gradeLevels.add(level);
      }
      const matchesGrade = !announcement.gradeLevel || gradeLevels.has(announcement.gradeLevel);
      if (announcement.targetParents && matchesGrade) return announcement;
      throw new ForbiddenException('This announcement is not visible to you');
    }

    throw new ForbiddenException('This announcement is not visible to you');
  }
}

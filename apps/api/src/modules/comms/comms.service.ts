import { ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { CommsRepository } from './comms.repository';
import type { CreateAnnouncementDto } from './comms.dto';
import type { Announcement } from './comms.types';

const STAFF_ROLES = new Set(['teacher', 'school_admin', 'principal', 'platform_admin']);

@Injectable()
export class CommsService {
  constructor(private readonly repo: CommsRepository) {}

  async create(user: AuthenticatedUser, dto: CreateAnnouncementDto): Promise<Announcement> {
    if (!STAFF_ROLES.has(user.role)) {
      throw new ForbiddenException('Only staff can post announcements');
    }
    return this.repo.create({ ...dto, createdBy: user.userId });
  }
}

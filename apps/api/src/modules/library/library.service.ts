import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import type { CreateResourceDto, ListResourcesQueryDto } from './library.dto';
import { LibraryRepository } from './library.repository';
import type { LibraryResource } from './library.types';

const STAFF_ROLES = new Set(['teacher', 'school_admin', 'principal', 'platform_admin']);

@Injectable()
export class LibraryService {
  constructor(private readonly repo: LibraryRepository) {}

  async createResource(user: AuthenticatedUser, dto: CreateResourceDto): Promise<LibraryResource> {
    if (!STAFF_ROLES.has(user.role)) {
      throw new ForbiddenException('Only staff can publish library resources');
    }
    // Explicit field-by-field construction rather than a spread: this
    // removes any dependency on how a given TypeScript/zod version
    // infers optionality across the DTO -> repository boundary.
    return this.repo.createResource({
      title: dto.title,
      resourceType: dto.resourceType,
      subject: dto.subject,
      gradeLevel: dto.gradeLevel,
      description: dto.description,
      storageKey: dto.storageKey,
      tags: dto.tags,
      createdBy: user.userId
    });
  }

  async getResource(id: string): Promise<LibraryResource> {
    const resource = await this.repo.findResource(id);
    if (!resource) throw new NotFoundException('Resource not found');
    return resource;
  }

  listResources(filter: ListResourcesQueryDto): Promise<LibraryResource[]> {
    return this.repo.listResources(filter);
  }

  async recordAccess(
    user: AuthenticatedUser,
    resourceId: string,
    action: 'viewed' | 'downloaded'
  ): Promise<void> {
    // Every authenticated tenant member may browse the library — no
    // staff/learner distinction here, unlike medical records or
    // grading. Existence is still checked so a bad id fails loudly.
    await this.getResource(resourceId);
    await this.repo.logAccess(resourceId, user.userId, action);
  }

  listRecentForUser(user: AuthenticatedUser) {
    return this.repo.listRecentForUser(user.userId);
  }
}

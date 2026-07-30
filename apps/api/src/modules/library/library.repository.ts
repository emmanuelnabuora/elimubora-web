import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../../core/audit/audit.service';
import { DatabaseService } from '../../core/database/database.service';
import type { LibraryResource, ResourceType } from './library.types';

interface ResourceRow {
  id: string;
  title: string;
  resource_type: ResourceType;
  subject: string;
  grade_level: string | null;
  description: string | null;
  storage_key: string;
  tags: string[];
  created_by: string;
}
const toResource = (r: ResourceRow): LibraryResource => ({
  id: r.id,
  title: r.title,
  resourceType: r.resource_type,
  subject: r.subject,
  gradeLevel: r.grade_level,
  description: r.description,
  storageKey: r.storage_key,
  tags: r.tags,
  createdBy: r.created_by
});

@Injectable()
export class LibraryRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService
  ) {}

  async createResource(input: {
    title: string;
    resourceType: ResourceType;
    subject: string;
    gradeLevel?: string;
    description?: string;
    storageKey: string;
    tags: string[];
    createdBy: string;
  }): Promise<LibraryResource> {
    return this.db.withTenantTransaction(async (client) => {
      const id = randomUUID();
      const { rows } = await client.query<ResourceRow>(
        `INSERT INTO library.resources
           (id, tenant_id, title, resource_type, subject, grade_level, description,
            storage_key, tags, created_by)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          id,
          input.title,
          input.resourceType,
          input.subject,
          input.gradeLevel ?? null,
          input.description ?? null,
          input.storageKey,
          input.tags,
          input.createdBy
        ]
      );
      await this.audit.record(client, {
        action: 'library_resource.created',
        entityType: 'library_resource',
        entityId: id,
        after: { title: input.title, resourceType: input.resourceType }
      });
      return toResource(rows[0]!);
    });
  }

  async findResource(id: string): Promise<LibraryResource | null> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<ResourceRow>(
        `SELECT * FROM library.resources
          WHERE id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL`,
        [id]
      );
      return rows[0] ? toResource(rows[0]) : null;
    });
  }

  async listResources(filter: {
    subject?: string;
    gradeLevel?: string;
    resourceType?: ResourceType;
    tag?: string;
  }): Promise<LibraryResource[]> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<ResourceRow>(
        `SELECT * FROM library.resources
          WHERE tenant_id = core.current_tenant_id() AND deleted_at IS NULL
            AND ($1::text IS NULL OR subject = $1)
            AND ($2::text IS NULL OR grade_level = $2)
            AND ($3::text IS NULL OR resource_type = $3)
            AND ($4::text IS NULL OR $4 = ANY(tags))
          ORDER BY title`,
        [filter.subject ?? null, filter.gradeLevel ?? null, filter.resourceType ?? null, filter.tag ?? null]
      );
      return rows.map(toResource);
    });
  }

  async logAccess(resourceId: string, userId: string, action: 'viewed' | 'downloaded'): Promise<void> {
    await this.db.withTenantTransaction(async (client) => {
      await client.query(
        `INSERT INTO library.resource_access_log (tenant_id, resource_id, user_id, action)
         VALUES (core.current_tenant_id(), $1, $2, $3)`,
        [resourceId, userId, action]
      );
    });
  }

  async listRecentForUser(
    userId: string,
    limit = 20
  ): Promise<Array<{ resourceId: string; action: string; accessedAt: string }>> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{ resource_id: string; action: string; accessed_at: Date }>(
        `SELECT resource_id, action, accessed_at FROM library.resource_access_log
          WHERE user_id = $1 AND tenant_id = core.current_tenant_id()
          ORDER BY accessed_at DESC
          LIMIT $2`,
        [userId, limit]
      );
      return rows.map((r) => ({
        resourceId: r.resource_id,
        action: r.action,
        accessedAt: r.accessed_at.toISOString()
      }));
    });
  }
}

import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../../core/audit/audit.service';
import { DatabaseService } from '../../core/database/database.service';
import type { Announcement } from './comms.types';

interface Row {
  id: string;
  title: string;
  body: string;
  grade_level: string | null;
  created_by: string;
  created_at: Date;
}
const toAnnouncement = (r: Row): Announcement => ({
  id: r.id,
  title: r.title,
  body: r.body,
  gradeLevel: r.grade_level,
  createdBy: r.created_by,
  createdAt: r.created_at.toISOString()
});

@Injectable()
export class CommsRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService
  ) {}

  async create(input: { title: string; body: string; gradeLevel?: string; createdBy: string }): Promise<Announcement> {
    return this.db.withTenantTransaction(async (client) => {
      const id = randomUUID();
      const { rows } = await client.query<Row>(
        `INSERT INTO comms.announcements (id, tenant_id, title, body, grade_level, created_by)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4, $5)
         RETURNING *`,
        [id, input.title, input.body, input.gradeLevel ?? null, input.createdBy]
      );
      await this.audit.record(client, {
        action: 'announcement.created',
        entityType: 'announcement',
        entityId: id,
        after: { title: input.title }
      });
      return toAnnouncement(rows[0]!);
    });
  }

  /** Relevant to a guardian: whole-school announcements plus those targeted at their child's grade. */
  async listForGradeLevels(gradeLevels: string[], limit = 50): Promise<Announcement[]> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<Row>(
        `SELECT * FROM comms.announcements
          WHERE tenant_id = core.current_tenant_id() AND deleted_at IS NULL
            AND (grade_level IS NULL OR grade_level = ANY($1::text[]))
          ORDER BY created_at DESC
          LIMIT $2`,
        [gradeLevels, limit]
      );
      return rows.map(toAnnouncement);
    });
  }
}

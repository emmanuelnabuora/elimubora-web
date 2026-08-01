import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../../core/audit/audit.service';
import { DatabaseService } from '../../core/database/database.service';
import { WorkerDatabaseService } from '../../core/database/worker-database.service';
import type { Device, DevicePlatform, UploadRecord } from './mobile.types';

interface DeviceRow extends Record<string, unknown> {
  id: string;
  user_id: string;
  platform: DevicePlatform;
  push_token: string;
  last_seen_at: Date;
}
const toDevice = (r: DeviceRow): Device => ({
  id: r.id,
  userId: r.user_id,
  platform: r.platform,
  pushToken: r.push_token,
  lastSeenAt: r.last_seen_at.toISOString()
});

interface UploadRow {
  id: string;
  uploaded_by: string;
  storage_key: string;
  content_type: string;
  size_bytes: number;
  created_at: Date;
}
const toUpload = (r: UploadRow): UploadRecord => ({
  id: r.id,
  uploadedBy: r.uploaded_by,
  storageKey: r.storage_key,
  contentType: r.content_type,
  sizeBytes: r.size_bytes,
  createdAt: r.created_at.toISOString()
});

@Injectable()
export class MobileRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly workerDb: WorkerDatabaseService,
    private readonly audit: AuditService
  ) {}

  // ---------------- devices ----------------

  async registerDevice(input: {
    userId: string;
    platform: DevicePlatform;
    pushToken: string;
  }): Promise<Device> {
    return this.db.withTenantTransaction(async (client) => {
      const id = randomUUID();
      const { rows } = await client.query<DeviceRow>(
        `INSERT INTO mobile.devices (id, tenant_id, user_id, platform, push_token)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4)
         ON CONFLICT (push_token) DO UPDATE SET
           user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, last_seen_at = now()
         RETURNING *`,
        [id, input.userId, input.platform, input.pushToken]
      );
      await this.audit.record(client, {
        action: 'device.registered',
        entityType: 'device',
        entityId: rows[0]!.id,
        after: { platform: input.platform }
      });
      return toDevice(rows[0]!);
    });
  }

  async unregisterDevice(pushToken: string): Promise<boolean> {
    return this.db.withTenantTransaction(async (client) => {
      const res = await client.query(
        `DELETE FROM mobile.devices WHERE push_token = $1 AND tenant_id = core.current_tenant_id()`,
        [pushToken]
      );
      return (res.rowCount ?? 0) === 1;
    });
  }

  /**
   * Cross-tenant read via the worker role — a single announcement can
   * target guardians across many schools. Mirrors Government
   * Dashboard's use of WorkerDatabaseService (ADR-012); this is the
   * second real consumer of that primitive.
   */
  async listDeviceTokensForUsers(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) return [];
    const { rows } = await this.workerDb.query<{ push_token: string }>(
      `SELECT push_token FROM mobile.devices WHERE user_id = ANY($1::uuid[])`,
      [userIds]
    );
    return rows.map((r) => r.push_token);
  }

  // ---------------- uploads ----------------

  async recordUpload(input: {
    uploadedBy: string;
    storageKey: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<UploadRecord> {
    return this.db.withTenantTransaction(async (client) => {
      const id = randomUUID();
      const { rows } = await client.query<UploadRow>(
        `INSERT INTO mobile.uploads (id, tenant_id, uploaded_by, storage_key, content_type, size_bytes)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4, $5)
         RETURNING *`,
        [id, input.uploadedBy, input.storageKey, input.contentType, input.sizeBytes]
      );
      await this.audit.record(client, {
        action: 'upload.created',
        entityType: 'upload',
        entityId: rows[0]!.id,
        after: { contentType: input.contentType, sizeBytes: input.sizeBytes }
      });
      return toUpload(rows[0]!);
    });
  }

  async findUploadByStorageKey(storageKey: string): Promise<UploadRecord | null> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<UploadRow>(
        `SELECT * FROM mobile.uploads WHERE storage_key = $1 AND tenant_id = core.current_tenant_id()`,
        [storageKey]
      );
      return rows[0] ? toUpload(rows[0]) : null;
    });
  }
}

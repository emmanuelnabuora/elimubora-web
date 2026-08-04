import type { PoolClient } from 'pg';
import { TenantContext } from '../tenancy/tenant-context';
import type { DatabaseService } from '../database/database.service';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  it('writes an append-only entry attributed to the request', async () => {
    const calls: Array<{ text: string; params: unknown[] }> = [];
    const client = {
      query: jest.fn(async (text: string, params: unknown[]) => {
        calls.push({ text, params });
        return { rows: [] };
      })
    } as unknown as PoolClient;

    // record() never touches this.db — only the new listRecent()
    // method does, which this test doesn't exercise — so a stub is
    // enough rather than a real DatabaseService.
    const service = new AuditService({} as DatabaseService);
    await TenantContext.run({ requestId: 'req-9', tenantId: 't1' }, () =>
      service.record(client, {
        action: 'tenant.updated',
        entityType: 'tenant',
        entityId: 't1',
        before: { name: 'Old' },
        after: { name: 'New' }
      })
    );

    const call = calls[0];
    expect(call).toBeDefined();
    expect(call!.text).toContain('INSERT INTO core.audit_log');
    expect(call!.text).toContain('core.current_tenant_id()');
    expect(call!.params).toEqual([
      'user',
      'tenant.updated',
      'tenant',
      't1',
      JSON.stringify({ name: 'Old' }),
      JSON.stringify({ name: 'New' }),
      'req-9'
    ]);
  });
});

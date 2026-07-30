import type { PoolClient } from 'pg';
import { OutboxService } from './outbox.service';

describe('OutboxService', () => {
  it('inserts the event with tenant stamped by the database, not the caller', async () => {
    const calls: Array<{ text: string; params: unknown[] }> = [];
    const client = {
      query: jest.fn(async (text: string, params: unknown[]) => {
        calls.push({ text, params });
        return { rows: [{ event_id: 'evt-123' }] };
      })
    } as unknown as PoolClient;

    const service = new OutboxService();
    const eventId = await service.append(client, {
      aggregateType: 'tenant',
      aggregateId: 't-1',
      eventType: 'tenant.created.v1',
      payload: { slug: 'moi-girls' }
    });

    expect(eventId).toBe('evt-123');
    const call = calls[0];
    expect(call).toBeDefined();
    // Tenant comes from core.current_tenant_id() inside the SQL — the
    // service must not accept or pass a tenant id parameter.
    expect(call!.text).toContain('core.current_tenant_id()');
    expect(call!.params).toEqual([
      'tenant',
      't-1',
      'tenant.created.v1',
      JSON.stringify({ slug: 'moi-girls' })
    ]);
  });
});

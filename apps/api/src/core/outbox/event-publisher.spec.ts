import type { DomainEvent } from '@elimubora/domain';
import { InProcessEventPublisher } from './event-publisher';

const event = (eventType: string): DomainEvent => ({
  eventId: 'e1',
  tenantId: 't1',
  aggregateType: 'tenant',
  aggregateId: 'a1',
  eventType,
  payload: {},
  occurredAt: new Date().toISOString()
});

describe('InProcessEventPublisher', () => {
  it('delivers only to handlers subscribed to the event type', async () => {
    const publisher = new InProcessEventPublisher();
    const created = jest.fn();
    const updated = jest.fn();
    publisher.subscribe('tenant.created.v1', created);
    publisher.subscribe('tenant.updated.v1', updated);

    await publisher.publish(event('tenant.created.v1'));

    expect(created).toHaveBeenCalledTimes(1);
    expect(updated).not.toHaveBeenCalled();
  });

  it('propagates handler failures so the relay retries', async () => {
    const publisher = new InProcessEventPublisher();
    publisher.subscribe('tenant.created.v1', () => {
      throw new Error('consumer down');
    });
    await expect(publisher.publish(event('tenant.created.v1'))).rejects.toThrow('consumer down');
  });
});

import type { DomainEvent } from '@elimubora/domain';

/**
 * Transport abstraction for the outbox relay. Sprint 1 ships an
 * in-process publisher (handlers within the monolith subscribe to
 * events they don't own). When a module is extracted to a service,
 * this interface is implemented over Kafka/SQS without touching
 * producers or the relay.
 */
export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>;
}

export const EVENT_PUBLISHER = Symbol('EVENT_PUBLISHER');

export type EventHandler = (event: DomainEvent) => Promise<void> | void;

export class InProcessEventPublisher implements EventPublisher {
  private readonly handlers = new Map<string, Set<EventHandler>>();

  subscribe(eventType: string, handler: EventHandler): void {
    const set = this.handlers.get(eventType) ?? new Set<EventHandler>();
    set.add(handler);
    this.handlers.set(eventType, set);
  }

  async publish(event: DomainEvent): Promise<void> {
    const set = this.handlers.get(event.eventType);
    if (!set) return;
    // Handlers run sequentially; a throwing handler fails the delivery
    // so the relay retries — consumers must therefore be idempotent
    // (dedupe on eventId).
    for (const handler of set) {
      await handler(event);
    }
  }
}

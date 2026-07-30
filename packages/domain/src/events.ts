/**
 * Domain event contract shared by every module.
 *
 * Event types are versioned strings: '<aggregate>.<action>.v<N>'.
 * Consumers must tolerate unknown fields (additive evolution) and
 * never receive breaking changes within a version.
 */
export interface DomainEvent<TPayload = unknown> {
  /** Globally unique, used for consumer-side idempotency. */
  eventId: string;
  /** Null for platform-level (cross-tenant) events. */
  tenantId: string | null;
  aggregateType: string;
  aggregateId: string;
  /** e.g. 'tenant.created.v1' */
  eventType: string;
  payload: TPayload;
  /** ISO-8601 timestamp of the state change. */
  occurredAt: string;
}

/** Registry of event types owned by the core platform. */
export const CoreEvents = {
  TenantCreated: 'tenant.created.v1',
  TenantUpdated: 'tenant.updated.v1',
  TenantSuspended: 'tenant.suspended.v1'
} as const;

export type CoreEventType = (typeof CoreEvents)[keyof typeof CoreEvents];

export interface TenantCreatedPayload {
  tenantId: string;
  slug: string;
  name: string;
  kind: string;
}

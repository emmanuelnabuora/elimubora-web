import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
  tenantId?: string;
  actorId?: string;
}

/**
 * Per-request context propagated via AsyncLocalStorage. The database
 * layer reads it to bind RLS settings; the audit layer reads it for
 * attribution. No request state is ever stored on singletons.
 */
export class TenantContext {
  private static readonly storage = new AsyncLocalStorage<RequestContext>();

  static run<T>(context: RequestContext, fn: () => T): T {
    return this.storage.run(context, fn);
  }

  static current(): RequestContext | undefined {
    return this.storage.getStore();
  }

  static requireTenantId(): string {
    const tenantId = this.storage.getStore()?.tenantId;
    if (!tenantId) {
      throw new Error('No tenant bound to the current request context');
    }
    return tenantId;
  }
}

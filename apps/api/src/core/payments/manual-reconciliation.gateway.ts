import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { PaymentGateway } from './payment-gateway.port';

/**
 * Sandbox implementation — see payment-gateway.port.ts for the
 * disclaimer. No network call is made. A locally generated reference
 * is returned immediately in 'pending' status; a real confirmation
 * (in production: Safaricom's callback; here: an explicit reconciler
 * action) is required before any invoice balance changes — payments
 * are treated as hints, reconciliation is the source of truth, exactly
 * as decided for the Kenya integration layer generally.
 */
@Injectable()
export class ManualReconciliationGateway implements PaymentGateway {
  private readonly logger = new Logger(ManualReconciliationGateway.name);

  async initiate(input: {
    amount: number;
    phone: string;
    accountReference: string;
  }): Promise<{ reference: string; status: 'pending' }> {
    const reference = `SANDBOX-${randomUUID().slice(0, 8).toUpperCase()}`;
    this.logger.log(
      `[sandbox] would STK-push KES ${input.amount} to ${input.phone} ` +
        `(account ${input.accountReference}) — reference ${reference} awaiting manual confirmation`
    );
    return { reference, status: 'pending' };
  }
}

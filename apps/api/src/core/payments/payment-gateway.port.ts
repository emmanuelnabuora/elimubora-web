/**
 * Kenya-integration anti-corruption boundary for payment gateways
 * (per the platform's founding architecture principle: M-Pesa, banks,
 * and other external payment rails sit behind an adapter so the rest
 * of the platform never depends on a specific provider's API shape).
 *
 * IMPORTANT — sandbox disclaimer: this codebase has no real Safaricom
 * Daraja API credentials. `ManualReconciliationGateway` (the only
 * implementation provided) does NOT call Safaricom or any external
 * service; it generates a local pending reference and waits for an
 * explicit confirmation call, modeling the shape of a real STK Push
 * flow without fabricating a successful payment. A production Daraja
 * adapter implementing this same interface is the natural next step
 * and requires no change to the Finance module's application code —
 * only a different provider registration in FinanceModule.
 */
export interface PaymentGateway {
  /**
   * Starts a payment. For a real M-Pesa integration this triggers an
   * STK Push to the payer's phone; the returned reference is what the
   * gateway's callback will later confirm against.
   */
  initiate(input: {
    amount: number;
    phone: string;
    accountReference: string;
  }): Promise<{ reference: string; status: 'pending' }>;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

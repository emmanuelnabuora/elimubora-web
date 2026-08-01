/**
 * Push-notification boundary, architecturally identical to the AI
 * (core/ai/) and payment (core/payments/) ports: a narrow interface
 * any domain module can depend on, one honestly-labeled sandbox
 * implementation, and a production provider (Firebase Cloud
 * Messaging for Android, APNs for iOS) as a drop-in replacement
 * requiring no application-code change — only a different
 * registration in CoreModule.
 *
 * SANDBOX DISCLAIMER: this codebase has no real FCM/APNs credentials.
 * `SandboxPushProvider` (the only implementation provided) does NOT
 * call any push service; it logs what would have been sent. This
 * matters for verification: a "push notification was sent" claim
 * without a real provider registered would be exactly the kind of
 * dishonesty the AI and M-Pesa sandboxes both deliberately avoided.
 */
export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushProvider {
  /** Sends to one device token; returns whether the provider accepted it. */
  send(pushToken: string, message: PushMessage): Promise<{ accepted: boolean }>;
}

export const PUSH_PROVIDER = Symbol('PUSH_PROVIDER');

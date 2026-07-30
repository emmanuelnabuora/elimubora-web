import { Injectable, Logger } from '@nestjs/common';

export interface NotificationMessage {
  to: { email?: string; phone?: string };
  template: string;
  data: Record<string, unknown>;
}

/**
 * Delivery port. The Communication module (Sprint 12) provides SMS,
 * WhatsApp and email channel implementations; until then the dev
 * channel logs deliveries so flows are fully exercisable locally.
 */
export interface NotificationChannel {
  deliver(message: NotificationMessage): Promise<void>;
}

export const NOTIFICATION_CHANNEL = Symbol('NOTIFICATION_CHANNEL');

@Injectable()
export class DevLogNotificationChannel implements NotificationChannel {
  private readonly logger = new Logger('Notifications');

  async deliver(message: NotificationMessage): Promise<void> {
    this.logger.log(
      `deliver template=${message.template} to=${message.to.email ?? message.to.phone ?? 'unknown'} data=${JSON.stringify(message.data)}`
    );
  }
}

import { Injectable, Logger } from '@nestjs/common';
import type { PushMessage, PushProvider } from './push-provider.port';

/** Sandbox implementation — see push-provider.port.ts for the disclaimer. */
@Injectable()
export class SandboxPushProvider implements PushProvider {
  private readonly logger = new Logger(SandboxPushProvider.name);

  async send(pushToken: string, message: PushMessage): Promise<{ accepted: boolean }> {
    this.logger.log(
      `[sandbox] would push to token ${pushToken.slice(0, 12)}...: "${message.title}" — ${message.body}`
    );
    return { accepted: true };
  }
}

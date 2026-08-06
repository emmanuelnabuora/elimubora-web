import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';

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

interface RenderedEmail {
  subject: string;
  textBody: string;
  htmlBody: string;
}

/**
 * Renders the two templates this app actually sends today
 * (invitation, password-reset) into real email content. Deliberately
 * plain — this is transactional email, not marketing, so clarity and
 * a working link matter far more than visual design.
 *
 * An unrecognized template renders a generic fallback rather than
 * throwing, so a future template type added to a .deliver() call
 * elsewhere in the app doesn't hard-fail delivery outright — it's
 * still visible in Postmark's own activity log for follow-up, and
 * this is logged loudly here too.
 */
function renderEmail(message: NotificationMessage): RenderedEmail {
  if (message.template === 'invitation') {
    const acceptUrl = String(message.data.acceptUrl ?? '');
    const role = String(message.data.role ?? 'a role');
    return {
      subject: 'You\u2019ve been invited to ElimuBora',
      textBody: `You've been invited to join ElimuBora as ${role}.\n\nAccept your invitation:\n${acceptUrl}\n\nIf you weren't expecting this, you can safely ignore this email.`,
      htmlBody: `<p>You've been invited to join <strong>ElimuBora</strong> as <strong>${role}</strong>.</p><p><a href="${acceptUrl}">Accept your invitation</a></p><p style="color:#666;font-size:13px">If you weren't expecting this, you can safely ignore this email.</p>`
    };
  }
  if (message.template === 'password-reset') {
    const resetUrl = String(message.data.resetUrl ?? '');
    return {
      subject: 'Reset your ElimuBora password',
      textBody: `A password reset was requested for your ElimuBora account.\n\nReset your password:\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email — your password won't change.`,
      htmlBody: `<p>A password reset was requested for your ElimuBora account.</p><p><a href="${resetUrl}">Reset your password</a></p><p style="color:#666;font-size:13px">If you didn't request this, you can safely ignore this email \u2014 your password won't change.</p>`
    };
  }
  return {
    subject: 'ElimuBora notification',
    textBody: JSON.stringify(message.data),
    htmlBody: `<pre>${JSON.stringify(message.data, null, 2)}</pre>`
  };
}

/**
 * Real email delivery via Postmark's REST API directly (native
 * fetch, no SDK dependency needed on Node 18+). Only ever
 * instantiated when both POSTMARK_API_TOKEN and POSTMARK_FROM_EMAIL
 * are configured -- see core.module.ts's provider selection, which
 * falls back to DevLogNotificationChannel otherwise so local dev and
 * tests are completely unaffected by this existing at all.
 *
 * A send failure here throws rather than swallowing the error --
 * callers (invitation creation, password reset) should know delivery
 * genuinely failed rather than silently believing it succeeded.
 */
@Injectable()
export class PostmarkNotificationChannel implements NotificationChannel {
  private readonly logger = new Logger('Notifications');

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async deliver(message: NotificationMessage): Promise<void> {
    const to = message.to.email;
    if (!to) {
      this.logger.warn(`Skipped delivery for template=${message.template} — no email address (phone-only recipients aren't supported yet)`);
      return;
    }
    const { subject, textBody, htmlBody } = renderEmail(message);
    const res = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': this.config.postmark!.apiToken!
      },
      body: JSON.stringify({
        From: this.config.postmark!.fromEmail,
        To: to,
        Subject: subject,
        TextBody: textBody,
        HtmlBody: htmlBody,
        MessageStream: 'outbound'
      })
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(`Postmark delivery failed for template=${message.template} to=${to}: ${res.status} ${body}`);
      throw new Error(`Postmark delivery failed (${res.status})`);
    }
  }
}

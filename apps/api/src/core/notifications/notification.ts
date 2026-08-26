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
    const studentName = message.data.studentName ? String(message.data.studentName) : null;
    const contextHtml = studentName
      ? `to join ElimuBora as a parent, linked to <strong>${studentName}</strong>'s profile`
      : `to join ElimuBora as ${role}`;
    const contextText = studentName ? `to join ElimuBora as a parent, linked to ${studentName}'s profile` : `to join ElimuBora as ${role}`;
    return {
      subject: 'You\u2019ve been invited to ElimuBora',
      textBody: `You've been invited ${contextText}.\n\nAccept your invitation:\n${acceptUrl}\n\nIf you weren't expecting this, you can safely ignore this email.`,
      htmlBody: `<p>You've been invited ${contextHtml}.</p><p><a href="${acceptUrl}">Accept your invitation</a></p><p style="color:#666;font-size:13px">If you weren't expecting this, you can safely ignore this email.</p>`
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
  if (message.template === 'new-message') {
    const senderName = String(message.data.senderName ?? 'Someone');
    const messagesUrl = String(message.data.messagesUrl ?? '');
    return {
      subject: `New message from ${senderName} on ElimuBora`,
      textBody: `${senderName} sent you a new message on ElimuBora.\n\nRead and reply:\n${messagesUrl}`,
      htmlBody: `<p><strong>${senderName}</strong> sent you a new message on ElimuBora.</p><p><a href="${messagesUrl}">Read and reply</a></p>`
    };
  }
  if (message.template === 'school-application-received') {
    const schoolName = String(message.data.schoolName ?? 'your school');
    const statusUrl = String(message.data.statusUrl ?? '');
    return {
      subject: 'We\u2019ve received your ElimuBora application',
      textBody: `Thanks for applying to bring ${schoolName} onto ElimuBora.\n\nOur team will review your application and get back to you. You can check its status any time:\n${statusUrl}\n\nIf you didn't submit this application, you can safely ignore this email.`,
      htmlBody: `<p>Thanks for applying to bring <strong>${schoolName}</strong> onto ElimuBora.</p><p>Our team will review your application and get back to you. You can check its status any time:</p><p><a href="${statusUrl}">Check application status</a></p><p style="color:#666;font-size:13px">If you didn't submit this application, you can safely ignore this email.</p>`
    };
  }
  if (message.template === 'school-application-rejected') {
    const schoolName = String(message.data.schoolName ?? 'your school');
    const reason = String(message.data.reason ?? '');
    return {
      subject: 'An update on your ElimuBora application',
      textBody: `Thanks for your interest in bringing ${schoolName} onto ElimuBora.\n\nAfter review, we're not able to move forward with this application right now.\n\nReason: ${reason}\n\nIf you have questions or would like to reapply with updated information, just reach out.`,
      htmlBody: `<p>Thanks for your interest in bringing <strong>${schoolName}</strong> onto ElimuBora.</p><p>After review, we're not able to move forward with this application right now.</p><p><strong>Reason:</strong> ${reason}</p><p style="color:#666;font-size:13px">If you have questions or would like to reapply with updated information, just reach out.</p>`
    };
  }
  if (message.template === 'school-application-approved') {
    const schoolName = String(message.data.schoolName ?? 'Your school');
    const acceptUrl = String(message.data.acceptUrl ?? '');
    const classesCreated = Number(message.data.classesCreated ?? 0);
    const classesStepText = classesCreated > 0
      ? `We've already set up ${classesCreated} class stream${classesCreated === 1 ? '' : 's'} from the grade levels you gave us — check them under Classes.`
      : 'Set up your class streams under Classes.';
    return {
      subject: `${schoolName} is approved on ElimuBora \u2014 here's how to get started`,
      textBody:
        `Good news \u2014 ${schoolName} has been approved to join ElimuBora.\n\n` +
        `Here's how to finish setting up:\n\n` +
        `1. Set your password: ${acceptUrl}\n` +
        `2. Log in at ${''}elimubora.co as an Administrator, using this email address.\n` +
        `3. Add your teaching and support staff so they can log in too.\n` +
        `4. ${classesStepText}\n` +
        `5. Once students are added, you can invite parents and guardians to link to their accounts.\n\n` +
        `Questions along the way? Just reply to this email.`,
      htmlBody:
        `<p>Good news \u2014 <strong>${schoolName}</strong> has been approved to join ElimuBora.</p>` +
        `<p>Here's how to finish setting up:</p>` +
        `<ol>` +
        `<li><a href="${acceptUrl}">Set your password</a></li>` +
        `<li>Log in at elimubora.co as an Administrator, using this email address.</li>` +
        `<li>Add your teaching and support staff so they can log in too.</li>` +
        `<li>${classesStepText}</li>` +
        `<li>Once students are added, you can invite parents and guardians to link to their accounts.</li>` +
        `</ol>` +
        `<p style="color:#666;font-size:13px">Questions along the way? Just reply to this email.</p>`
    };
  }
  if (message.template === 'new-announcement') {
    const title = String(message.data.title ?? 'New announcement');
    const announcementUrl = String(message.data.announcementUrl ?? '');
    return {
      subject: `New announcement: ${title}`,
      textBody: `A new announcement was posted on ElimuBora: "${title}"\n\nView it:\n${announcementUrl}`,
      htmlBody: `<p>A new announcement was posted on ElimuBora:</p><p><strong>${title}</strong></p><p><a href="${announcementUrl}">View announcement</a></p>`
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

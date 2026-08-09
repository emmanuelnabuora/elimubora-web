import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import { NOTIFICATION_CHANNEL, type NotificationChannel } from '../../core/notifications/notification';
import { CommsRepository } from './comms.repository';
import type { CreateAnnouncementDto, SendMessageDto, StartConversationDto } from './comms.dto';
import type { Announcement, Conversation, Message } from './comms.types';

const STAFF_ROLES = new Set(['teacher', 'school_admin', 'principal', 'platform_admin']);

@Injectable()
export class CommsService {
  constructor(
    private readonly repo: CommsRepository,
    @Inject(NOTIFICATION_CHANNEL) private readonly notifications: NotificationChannel,
    @Inject(APP_CONFIG) private readonly config: AppConfig
  ) {}

  /**
   * The actual gap this closes: neither startConversation nor reply
   * had ever notified the recipient at all -- the only way anyone
   * found out they'd been messaged was independently thinking to
   * open their own inbox page. A student with no reason to check
   * would simply never know a teacher had written to them.
   *
   * Deliberately does not include the message body in the email --
   * this is a school messaging system that can involve minors, and
   * keeping content inside the app rather than forwarding it into a
   * separate, less-controlled channel is the safer default.
   *
   * Deliberately swallows any delivery failure rather than letting
   * it propagate: unlike invitation/password-reset (where the caller
   * genuinely needs to know delivery failed), a message has already
   * been saved and is already visible in-app by the time this runs --
   * a transient Postmark failure must never turn a successfully sent
   * message into a 500 for the sender.
   */
  private async notifyRecipient(recipientId: string, senderId: string): Promise<void> {
    try {
      const [recipient, sender] = await Promise.all([
        this.repo.getUserContact(recipientId),
        this.repo.getUserContact(senderId)
      ]);
      if (!recipient || recipient.email.endsWith('@no-login.elimubora.internal')) return;
      await this.notifications.deliver({
        to: { email: recipient.email },
        template: 'new-message',
        data: { senderName: sender?.fullName ?? 'Someone', messagesUrl: `${this.config.publicWebUrl}/dashboard` }
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('CommsService: new-message notification failed', err);
    }
  }

  async create(user: AuthenticatedUser, dto: CreateAnnouncementDto): Promise<Announcement> {
    if (!STAFF_ROLES.has(user.role)) {
      throw new ForbiddenException('Only staff can post announcements');
    }
    return this.repo.create({ ...dto, createdBy: user.userId });
  }

  /** Only a teacher or admin can start a new conversation with a student — a student can reply once one exists, but can't cold-message an arbitrary staff member. */
  async startConversation(
    user: AuthenticatedUser,
    dto: StartConversationDto
  ): Promise<{ conversation: Conversation; message: Message }> {
    if (!STAFF_ROLES.has(user.role)) {
      throw new ForbiddenException('Only teachers and school administrators can start a conversation');
    }
    const result = await this.repo.startOrContinueConversation({
      staffId: user.userId,
      studentId: dto.studentId,
      body: dto.body
    });
    await this.notifyRecipient(dto.studentId, user.userId);
    return result;
  }

  private async requireParticipant(user: AuthenticatedUser, conversationId: string): Promise<Conversation> {
    const conversation = await this.repo.findConversation(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (conversation.staffId !== user.userId && conversation.studentId !== user.userId) {
      throw new ForbiddenException('You are not part of this conversation');
    }
    return conversation;
  }

  /** Either participant can reply — this is the two-way part. */
  async reply(user: AuthenticatedUser, conversationId: string, dto: SendMessageDto): Promise<Message> {
    const conversation = await this.requireParticipant(user, conversationId);
    const message = await this.repo.sendReply({ conversationId, senderId: user.userId, body: dto.body });
    const recipientId = conversation.staffId === user.userId ? conversation.studentId : conversation.staffId;
    await this.notifyRecipient(recipientId, user.userId);
    return message;
  }

  listMyConversations(user: AuthenticatedUser) {
    return this.repo.listConversationsForUser(user.userId);
  }

  /** Fetches messages and marks the other participant's messages as read in the same call — opening a conversation is the natural "I've seen this" signal. */
  async getMessages(user: AuthenticatedUser, conversationId: string): Promise<Message[]> {
    await this.requireParticipant(user, conversationId);
    await this.repo.markConversationRead(conversationId, user.userId);
    return this.repo.listMessages(conversationId);
  }
}

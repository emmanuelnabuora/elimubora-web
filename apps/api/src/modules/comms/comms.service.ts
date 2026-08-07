import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { CommsRepository } from './comms.repository';
import type { CreateAnnouncementDto, SendMessageDto, StartConversationDto } from './comms.dto';
import type { Announcement, Conversation, Message } from './comms.types';

const STAFF_ROLES = new Set(['teacher', 'school_admin', 'principal', 'platform_admin']);

@Injectable()
export class CommsService {
  constructor(private readonly repo: CommsRepository) {}

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
    return this.repo.startOrContinueConversation({ staffId: user.userId, studentId: dto.studentId, body: dto.body });
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
    await this.requireParticipant(user, conversationId);
    return this.repo.sendReply({ conversationId, senderId: user.userId, body: dto.body });
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

import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../../core/audit/audit.service';
import { DatabaseService } from '../../core/database/database.service';
import type { Announcement, Conversation, Message } from './comms.types';

interface Row {
  id: string;
  title: string;
  body: string;
  grade_level: string | null;
  target_students: boolean;
  target_parents: boolean;
  target_teachers: boolean;
  created_by: string;
  created_at: Date;
}
const toAnnouncement = (r: Row): Announcement => ({
  id: r.id,
  title: r.title,
  body: r.body,
  gradeLevel: r.grade_level,
  targetStudents: r.target_students,
  targetParents: r.target_parents,
  targetTeachers: r.target_teachers,
  createdBy: r.created_by,
  createdAt: r.created_at.toISOString()
});

interface ConversationRow {
  id: string;
  staff_id: string;
  student_id: string;
  last_message_at: Date;
  created_at: Date;
}
const toConversation = (r: ConversationRow): Conversation => ({
  id: r.id,
  staffId: r.staff_id,
  studentId: r.student_id,
  lastMessageAt: r.last_message_at.toISOString(),
  createdAt: r.created_at.toISOString()
});

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: Date | null;
  created_at: Date;
}
const toMessage = (r: MessageRow): Message => ({
  id: r.id,
  conversationId: r.conversation_id,
  senderId: r.sender_id,
  body: r.body,
  readAt: r.read_at ? r.read_at.toISOString() : null,
  createdAt: r.created_at.toISOString()
});

@Injectable()
export class CommsRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService
  ) {}

  /**
   * A message recipient's email and name, for notifying them a new
   * message arrived. core.users' RLS allows any tenant member to see
   * this for another member of the same tenant, which the sender and
   * recipient of an in-school conversation always are.
   */
  async getUserContact(userId: string): Promise<{ email: string; fullName: string } | null> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{ email: string; full_name: string }>(
        `SELECT email, full_name FROM core.users WHERE id = $1`,
        [userId]
      );
      return rows[0] ? { email: rows[0].email, fullName: rows[0].full_name } : null;
    });
  }

  async create(input: {
    title: string;
    body: string;
    gradeLevel?: string;
    targetStudents: boolean;
    targetParents: boolean;
    targetTeachers: boolean;
    createdBy: string;
  }): Promise<Announcement> {
    return this.db.withTenantTransaction(async (client) => {
      const id = randomUUID();
      const { rows } = await client.query<Row>(
        `INSERT INTO comms.announcements
           (id, tenant_id, title, body, grade_level, target_students, target_parents, target_teachers, created_by)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [id, input.title, input.body, input.gradeLevel ?? null, input.targetStudents, input.targetParents, input.targetTeachers, input.createdBy]
      );
      await this.audit.record(client, {
        action: 'announcement.created',
        entityType: 'announcement',
        entityId: id,
        after: { title: input.title }
      });
      return toAnnouncement(rows[0]!);
    });
  }

  /**
   * A single announcement by id -- for the detail view a notification
   * email (or a click from the list) deep-links to. Does not itself
   * enforce that the caller is actually in the announcement's target
   * audience; the service layer does that, matching how every other
   * per-role visibility rule in this module is enforced in application
   * code rather than in this raw lookup.
   */
  async findById(id: string): Promise<Announcement | null> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<Row>(
        `SELECT * FROM comms.announcements
          WHERE id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL`,
        [id]
      );
      return rows[0] ? toAnnouncement(rows[0]) : null;
    });
  }

  /**
   * Every real contact (email + name) the announcement's targeting
   * flags and grade level actually reach, for notification fan-out.
   * Mirrors listForGradeLevels'/listAll's own targeting rules exactly
   * -- gradeLevel null means whole-school, otherwise it must match --
   * rather than re-deriving a second, potentially divergent notion of
   * "who this announcement is for."
   *
   * Three distinct audiences, three distinct join paths -- run only
   * the ones actually targeted, not a single query that computes all
   * three and discards what wasn't asked for:
   *   - students: via their active class allocation's stream grade
   *   - parents: via a linked, portal-activated guardian of a student
   *     in a matching class allocation (a guardian with no user_id has
   *     no portal account yet and nothing to email)
   *   - teachers: every teacher at the school, ungated by grade --
   *     matching listAll's own "no single grade" rationale for staff
   */
  async getRecipientContacts(
    tenantId: string,
    gradeLevel: string | null,
    targetStudents: boolean,
    targetParents: boolean,
    targetTeachers: boolean
  ): Promise<Array<{ email: string; fullName: string; role: 'learner' | 'parent' | 'teacher' }>> {
    return this.db.withContext({ tenantId }, async (client) => {
      const results: Array<{ email: string; full_name: string; role: 'learner' | 'parent' | 'teacher' }> = [];

      if (targetStudents) {
        const { rows } = await client.query<{ email: string; full_name: string }>(
          `SELECT DISTINCT u.email, u.full_name
             FROM sis.class_allocations ca
             JOIN sis.class_streams cs ON cs.id = ca.class_stream_id
             JOIN core.users u ON u.id = ca.student_id
            WHERE ca.tenant_id = core.current_tenant_id() AND ca.status = 'active' AND ca.deleted_at IS NULL
              AND ($1::text IS NULL OR cs.grade_level = $1)`,
          [gradeLevel]
        );
        results.push(...rows.map((r) => ({ ...r, role: 'learner' as const })));
      }

      if (targetParents) {
        const { rows } = await client.query<{ email: string; full_name: string }>(
          `SELECT DISTINCT u.email, u.full_name
             FROM sis.student_guardians sg
             JOIN sis.guardians g ON g.id = sg.guardian_id AND g.user_id IS NOT NULL
             JOIN core.users u ON u.id = g.user_id
             JOIN sis.class_allocations ca ON ca.student_id = sg.student_id AND ca.status = 'active' AND ca.deleted_at IS NULL
             JOIN sis.class_streams cs ON cs.id = ca.class_stream_id
            WHERE sg.tenant_id = core.current_tenant_id() AND sg.deleted_at IS NULL
              AND ($1::text IS NULL OR cs.grade_level = $1)`,
          [gradeLevel]
        );
        results.push(...rows.map((r) => ({ ...r, role: 'parent' as const })));
      }

      if (targetTeachers) {
        const { rows } = await client.query<{ email: string; full_name: string }>(
          `SELECT DISTINCT u.email, u.full_name
             FROM core.memberships m
             JOIN core.users u ON u.id = m.user_id
            WHERE m.tenant_id = core.current_tenant_id() AND m.role = 'teacher' AND m.deleted_at IS NULL`
        );
        results.push(...rows.map((r) => ({ ...r, role: 'teacher' as const })));
      }

      // A person can legitimately appear more than once (e.g. a
      // guardian of two children in the same class, or a teacher who
      // is also a parent) -- dedupe on email so they get exactly one
      // notification per announcement, not one per matching row.
      const seen = new Set<string>();
      return results
        .filter((r) => (seen.has(r.email) ? false : (seen.add(r.email), true)))
        .map((r) => ({ email: r.email, fullName: r.full_name, role: r.role }));
    });
  }

  /**
   * Relevant to a student or a guardian: whole-school announcements
   * plus those targeted at their (or their child's) grade -- and,
   * with audience targeting, only the ones actually meant for that
   * audience. The two callers (a learner reading their own
   * announcements, a guardian reading a linked child's) pass
   * 'students' or 'parents' respectively, since the same grade-level
   * announcement can be scoped to reach one without the other.
   */
  async listForGradeLevels(gradeLevels: string[], audience: 'students' | 'parents', limit = 50): Promise<Announcement[]> {
    const audienceColumn = audience === 'students' ? 'target_students' : 'target_parents';
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<Row>(
        `SELECT * FROM comms.announcements
          WHERE tenant_id = core.current_tenant_id() AND deleted_at IS NULL
            AND (grade_level IS NULL OR grade_level = ANY($1::text[]))
            AND ${audienceColumn} = true
          ORDER BY created_at DESC
          LIMIT $2`,
        [gradeLevels, limit]
      );
      return rows.map(toAnnouncement);
    });
  }

  /** Every announcement targeted at teachers, in the tenant — the staff-facing view (a teacher or admin has no single "grade" to filter by, unlike a learner or a guardian's specific children). */
  async listAll(limit = 50): Promise<Announcement[]> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<Row>(
        `SELECT * FROM comms.announcements
          WHERE tenant_id = core.current_tenant_id() AND deleted_at IS NULL AND target_teachers = true
          ORDER BY created_at DESC
          LIMIT $1`,
        [limit]
      );
      return rows.map(toAnnouncement);
    });
  }

  // ---------------- direct messaging ----------------

  /**
   * Starts a new conversation between this staff member and student,
   * or continues the existing one if they've already messaged before
   * — ON CONFLICT DO UPDATE against the (tenant, staff, student)
   * unique constraint rather than a separate find-then-create round
   * trip, so this is safe under concurrent sends too.
   */
  async startOrContinueConversation(input: {
    staffId: string;
    studentId: string;
    body: string;
  }): Promise<{ conversation: Conversation; message: Message }> {
    return this.db.withTenantTransaction(async (client) => {
      const convId = randomUUID();
      const { rows: convRows } = await client.query<ConversationRow>(
        `INSERT INTO comms.conversations (id, tenant_id, staff_id, student_id, last_message_at)
         VALUES ($1, core.current_tenant_id(), $2, $3, now())
         ON CONFLICT (tenant_id, staff_id, student_id)
         DO UPDATE SET last_message_at = now(), updated_at = now()
         RETURNING *`,
        [convId, input.staffId, input.studentId]
      );
      const conversation = toConversation(convRows[0]!);

      const msgId = randomUUID();
      const { rows: msgRows } = await client.query<MessageRow>(
        `INSERT INTO comms.messages (id, tenant_id, conversation_id, sender_id, body)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4)
         RETURNING *`,
        [msgId, conversation.id, input.staffId, input.body]
      );
      await this.audit.record(client, {
        action: 'conversation.message_sent',
        entityType: 'conversation',
        entityId: conversation.id,
        after: { senderId: input.staffId }
      });
      return { conversation, message: toMessage(msgRows[0]!) };
    });
  }

  async sendReply(input: { conversationId: string; senderId: string; body: string }): Promise<Message> {
    return this.db.withTenantTransaction(async (client) => {
      const id = randomUUID();
      const { rows } = await client.query<MessageRow>(
        `INSERT INTO comms.messages (id, tenant_id, conversation_id, sender_id, body)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4)
         RETURNING *`,
        [id, input.conversationId, input.senderId, input.body]
      );
      await client.query(
        `UPDATE comms.conversations SET last_message_at = now(), updated_at = now()
          WHERE id = $1 AND tenant_id = core.current_tenant_id()`,
        [input.conversationId]
      );
      await this.audit.record(client, {
        action: 'conversation.message_sent',
        entityType: 'conversation',
        entityId: input.conversationId,
        after: { senderId: input.senderId }
      });
      return toMessage(rows[0]!);
    });
  }

  /** A conversation belongs to exactly two people — fetched by ID so the caller can verify participation before allowing access. */
  async findConversation(conversationId: string): Promise<Conversation | null> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<ConversationRow>(
        `SELECT * FROM comms.conversations
          WHERE id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL`,
        [conversationId]
      );
      return rows[0] ? toConversation(rows[0]) : null;
    });
  }

  /** Every conversation this user is a participant in, as either the staff side or the student side, with the other participant's name and an unread count for inbox display. */
  async listConversationsForUser(
    userId: string
  ): Promise<Array<Conversation & { otherPartyName: string; unreadCount: number }>> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<
        ConversationRow & { other_party_name: string; unread_count: string }
      >(
        `SELECT c.*,
                u.full_name AS other_party_name,
                (SELECT count(*) FROM comms.messages m
                  WHERE m.conversation_id = c.id AND m.sender_id != $1
                    AND m.read_at IS NULL AND m.deleted_at IS NULL) AS unread_count
           FROM comms.conversations c
           JOIN core.users u ON u.id = (CASE WHEN c.staff_id = $1 THEN c.student_id ELSE c.staff_id END)
          WHERE c.tenant_id = core.current_tenant_id() AND c.deleted_at IS NULL
            AND (c.staff_id = $1 OR c.student_id = $1)
          ORDER BY c.last_message_at DESC`,
        [userId]
      );
      return rows.map((r) => ({ ...toConversation(r), otherPartyName: r.other_party_name, unreadCount: Number(r.unread_count) }));
    });
  }

  async listMessages(conversationId: string): Promise<Message[]> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<MessageRow>(
        `SELECT * FROM comms.messages
          WHERE conversation_id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL
          ORDER BY created_at ASC`,
        [conversationId]
      );
      return rows.map(toMessage);
    });
  }

  /** Marks every unread message in the conversation as read, except the reader's own — you don't "read" what you sent yourself. */
  async markConversationRead(conversationId: string, readerId: string): Promise<void> {
    return this.db.withTenantTransaction(async (client) => {
      await client.query(
        `UPDATE comms.messages SET read_at = now(), updated_at = now()
          WHERE conversation_id = $1 AND tenant_id = core.current_tenant_id()
            AND sender_id != $2 AND read_at IS NULL AND deleted_at IS NULL`,
        [conversationId, readerId]
      );
    });
  }
}

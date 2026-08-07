-- 0024_direct_messaging.sql
--
-- Real two-way direct messaging between a staff member (teacher or
-- school_admin/principal) and a student -- distinct from
-- comms.announcements, which is one-way broadcast (whole-school or
-- grade-level, no reply). This was explicitly deferred as separate
-- scope when announcements were built (see 0007's own comment), and
-- is being built now as its own real conversation/message model.
--
-- One conversation per (staff, student) pair -- a student messaging
-- two different teachers gets two separate conversations, not one
-- shared thread, matching how a real inbox works.
--
-- RLS here only enforces tenant isolation, same as every other
-- table -- it does NOT restrict a conversation to just its two
-- participants. That finer-grained "only my own conversations"
-- check happens at the application/repository layer via explicit
-- WHERE staff_id = $1 OR student_id = $1 filtering, matching the
-- established pattern elsewhere in this codebase (e.g.
-- listChildrenForGuardianUser) rather than a novel RLS policy shape.

CREATE TABLE comms.conversations (
  id               uuid PRIMARY KEY,
  tenant_id        uuid NOT NULL REFERENCES core.tenants(id),
  staff_id         uuid NOT NULL REFERENCES core.users(id),
  student_id       uuid NOT NULL REFERENCES core.users(id),
  last_message_at  timestamptz NOT NULL DEFAULT now(),
  row_version      bigint NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  UNIQUE (tenant_id, staff_id, student_id)
);
CREATE INDEX idx_conversations_staff ON comms.conversations (tenant_id, staff_id, last_message_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_conversations_student ON comms.conversations (tenant_id, student_id, last_message_at DESC)
  WHERE deleted_at IS NULL;
SELECT core.make_syncable('comms.conversations');

CREATE TABLE comms.messages (
  id               uuid PRIMARY KEY,
  tenant_id        uuid NOT NULL REFERENCES core.tenants(id),
  conversation_id  uuid NOT NULL REFERENCES comms.conversations(id),
  sender_id        uuid NOT NULL REFERENCES core.users(id),
  body             text NOT NULL,
  read_at          timestamptz,
  row_version      bigint NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);
CREATE INDEX idx_messages_conversation ON comms.messages (conversation_id, created_at)
  WHERE deleted_at IS NULL;
SELECT core.make_syncable('comms.messages');

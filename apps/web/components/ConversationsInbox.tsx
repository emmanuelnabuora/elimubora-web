'use client';

import { useEffect, useRef, useState } from 'react';

interface ConversationSummary {
  id: string;
  staffId: string;
  studentId: string;
  otherPartyName: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export function ConversationsInbox({ currentUserId }: { currentUserId: string }) {
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  async function loadConversations() {
    const res = await fetch('/api/conversations');
    if (res.ok) setConversations(await res.json());
  }

  async function loadMessages(conversationId: string) {
    const res = await fetch(`/api/conversations/${conversationId}/messages`);
    if (res.ok) {
      setMessages(await res.json());
      // Viewing marks the other person's messages as read server-side;
      // refresh the list so this conversation's unread badge clears.
      loadConversations();
    }
  }

  useEffect(() => {
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendReply() {
    if (!selectedId || !replyText.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${selectedId}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: replyText.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not send that message.');
        return;
      }
      setReplyText('');
      setMessages((prev) => (prev ? [...prev, data] : [data]));
      loadConversations();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  }

  if (conversations === null) {
    return <p style={{ color: 'var(--eb-fg-muted)', fontSize: 14 }}>Loading conversations…</p>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, minHeight: 480 }}>
      <div style={{ border: '1px solid var(--eb-line)', borderRadius: 14, overflow: 'hidden' }}>
        {conversations.length === 0 ? (
          <p style={{ padding: 16, fontSize: 13, color: 'var(--eb-fg-muted)' }}>No conversations yet.</p>
        ) : (
          conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '12px 14px',
                border: 'none',
                borderBottom: '1px solid var(--eb-line)',
                background: c.id === selectedId ? 'var(--eb-bg-panel, #F5F4FF)' : 'transparent',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{c.otherPartyName}</span>
                {c.unreadCount > 0 && (
                  <span
                    style={{
                      background: 'var(--eb-primary)',
                      color: '#fff',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 7px'
                    }}
                  >
                    {c.unreadCount}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 12, color: 'var(--eb-fg-muted)' }}>
                {new Date(c.lastMessageAt).toLocaleString()}
              </span>
            </button>
          ))
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--eb-line)', borderRadius: 14 }}>
        {!selectedId ? (
          <p style={{ margin: 'auto', color: 'var(--eb-fg-muted)', fontSize: 14 }}>
            Select a conversation to view messages.
          </p>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages === null ? (
                <p style={{ color: 'var(--eb-fg-muted)', fontSize: 14 }}>Loading…</p>
              ) : (
                messages.map((m) => {
                  const mine = m.senderId === currentUserId;
                  return (
                    <div
                      key={m.id}
                      style={{
                        alignSelf: mine ? 'flex-end' : 'flex-start',
                        maxWidth: '70%',
                        background: mine ? 'var(--eb-primary)' : 'var(--eb-bg-panel, #F5F4FF)',
                        color: mine ? '#fff' : 'var(--eb-fg)',
                        borderRadius: 14,
                        padding: '9px 13px',
                        fontSize: 14
                      }}
                    >
                      {m.body}
                      <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
            <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--eb-line)' }}>
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendReply();
                  }
                }}
                placeholder="Type a message…"
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 999,
                  border: '1px solid var(--eb-line)',
                  fontSize: 14
                }}
              />
              <button
                onClick={sendReply}
                disabled={sending || !replyText.trim()}
                className="admin-submit"
                style={{ padding: '10px 20px' }}
              >
                Send
              </button>
            </div>
            {error && <p className="auth-error" style={{ padding: '0 12px 10px' }}>{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}

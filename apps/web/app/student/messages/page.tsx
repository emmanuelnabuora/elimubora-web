import { getCurrentUser } from '../../../lib/get-current-user';
import { ConversationsInbox } from '../../../components/ConversationsInbox';

export default async function StudentMessagesPage() {
  const result = await getCurrentUser();
  const userId = result!.user.id;

  return (
    <div>
      <h1 className="admin-page-title">Messages</h1>
      <p style={{ fontSize: 13, color: 'var(--eb-fg-muted)', marginTop: -12, marginBottom: 'var(--eb-space-6)' }}>
        Messages from your teachers and school administrators. Reply directly here.
      </p>
      <ConversationsInbox currentUserId={userId} />
    </div>
  );
}

import { getCurrentUser } from '../../../lib/get-current-user';
import { apiFetch } from '../../../lib/api-client';
import { ConversationsInbox } from '../../../components/ConversationsInbox';
import { StartConversationForm } from '../../../components/StartConversationForm';

interface StudentListItem {
  studentId: string;
  fullName: string;
}

export default async function AdminMessagesPage() {
  const [result, students] = await Promise.all([getCurrentUser(), apiFetch<StudentListItem[]>('/v1/students')]);
  const userId = result!.user.id;

  return (
    <div>
      <h1 className="admin-page-title">Messages</h1>

      <div className="admin-section">
        <h2 className="admin-section-title">Message a student</h2>
        <StartConversationForm students={students} />
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">Conversations</h2>
        <ConversationsInbox currentUserId={userId} />
      </div>
    </div>
  );
}

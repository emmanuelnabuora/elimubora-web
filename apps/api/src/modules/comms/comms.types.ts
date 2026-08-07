export interface Announcement {
  id: string;
  title: string;
  body: string;
  gradeLevel: string | null;
  targetStudents: boolean;
  targetParents: boolean;
  targetTeachers: boolean;
  createdBy: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  staffId: string;
  studentId: string;
  lastMessageAt: string;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

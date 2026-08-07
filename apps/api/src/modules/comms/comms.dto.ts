import { z } from 'zod';

export const createAnnouncementSchema = z.object({
  title: z.string().min(2).max(200),
  body: z.string().min(1).max(10_000),
  gradeLevel: z.string().max(10).optional()
});
export type CreateAnnouncementDto = z.infer<typeof createAnnouncementSchema>;

export const startConversationSchema = z.object({
  studentId: z.string().uuid(),
  body: z.string().min(1).max(5000)
});
export type StartConversationDto = z.infer<typeof startConversationSchema>;

export const sendMessageSchema = z.object({
  body: z.string().min(1).max(5000)
});
export type SendMessageDto = z.infer<typeof sendMessageSchema>;

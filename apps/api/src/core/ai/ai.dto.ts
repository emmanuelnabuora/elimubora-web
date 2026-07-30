import { z } from 'zod';

export const homeworkHelpSchema = z.object({
  subject: z.string().min(2).max(100),
  gradeLevel: z.string().min(2).max(10),
  question: z.string().min(3).max(2000)
});
export type HomeworkHelpDto = z.infer<typeof homeworkHelpSchema>;
